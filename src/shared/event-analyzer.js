/**
 * CleanClick — Event Listener Pattern Matcher
 *
 * Analyzes registered event listener functions to detect
 * navigation hijacking patterns.
 *
 * Used exclusively by event-inspector.js in content scripts.
 *
 * Limitations:
 * - Cannot inspect listeners registered on cross-origin iframes
 * - Cannot inspect native functions (they show as [native code])
 * - Minified/obfuscated code reduces detection confidence
 *
 * Pure functions — no browser API dependencies.
 */

import { HIJACK_EVENTS } from './constants.js';

// ─── Hijack Patterns ───────────────────────────────────────────────

/**
 * Patterns to search for in listener function source code.
 * Each pattern has a weight and a description.
 *
 * @type {Array<{ regex: RegExp, weight: number, label: string }>}
 */
const HIJACK_PATTERNS = [
  // Direct location assignment
  { regex: /window\s*\.\s*location\s*(?:\s*=\s*|\.\s*href\s*=)/i, weight: 20, label: 'window.location = ...' },
  { regex: /location\s*\.\s*href\s*=/, weight: 20, label: 'location.href = ...' },
  { regex: /location\s*\.\s*assign\s*\(/i, weight: 20, label: 'location.assign()' },
  { regex: /location\s*\.\s*replace\s*\(/i, weight: 15, label: 'location.replace()' },
  { regex: /document\s*\.\s*location\s*=/, weight: 20, label: 'document.location = ...' },
  { regex: /self\s*\.\s*location\s*=/, weight: 20, label: 'self.location = ...' },
  { regex: /top\s*\.\s*location\s*=/, weight: 25, label: 'top.location = ... (cross-origin redirect)' },

  // Window open
  { regex: /window\s*\.\s*open\s*\(/, weight: 15, label: 'window.open() called' },

  // Deferred navigation
  { regex: /setTimeout\s*\(\s*(?:function\s*\(|\(\)\s*=>|["'`][^"'`]*["'`]\s*,\s*\d)/i, weight: 10, label: 'setTimeout with delay (possible deferred hijack)' },
  { regex: /setInterval\s*\(\s*(?:function\s*\(|\(\)\s*=>)/i, weight: 10, label: 'setInterval (possible delayed hijack)' },
  { regex: /setTimeout\s*\([^)]*location/i, weight: 20, label: 'setTimeout + location (deferred redirect)' },

  // History manipulation
  { regex: /history\s*\.\s*(?:pushState|replaceState)\s*\(/, weight: 10, label: 'History API manipulation' },

  // Form manipulation
  { regex: /\.\s*submit\s*\(/, weight: 10, label: 'Form submit() called' },
  { regex: /form\s*\[\s*['"]action['"]\s*\]\s*=/, weight: 15, label: 'Form action modified' },

  // Prevent default + redirect
  { regex: /preventDefault\s*\(\s*\).*location/i, weight: 25, label: 'preventDefault + location redirect' },
  { regex: /preventDefault\s*\(\s*\).*window\.open/i, weight: 20, label: 'preventDefault + window.open' },
  { regex: /return\s+false;?\s*}\s*(?:function)?\s*{?\s*(?:window\.)?location/i, weight: 25, label: 'return false + location redirect' },

  // Dynamic href modification
  { regex: /this\s*\.\s*href\s*=/, weight: 15, label: 'this.href = ... (mutation on interaction)' },
  { regex: /\.\s*href\s*=\s*(['"`]|https?)/i, weight: 15, label: 'Element href modified' },
  { regex: /setAttribute\s*\(\s*['"]href['"]/, weight: 12, label: 'href attribute set dynamically' },

  // Meta refresh injection
  { regex: /meta\s+http-equiv\s*=\s*['"]refresh['"]/i, weight: 20, label: 'Meta refresh injected dynamically' },

  // Fetch/XMLHttpRequest + document.write
  { regex: /\.\s*open\s*\(\s*['"]GET['"]/, weight: 5, label: 'XHR/fetch request' },

  // PostMessage based navigation
  { regex: /postMessage\s*\(/, weight: 10, label: 'postMessage communication' },
];

// ─── Analysis Function ─────────────────────────────────────────────

/**
 * Analyze a function's source code for hijacking patterns.
 * @param {Function} fn - The event listener function
 * @returns {{
 *   isHijack: boolean,
 *   confidence: number,       // 0–100
 *   matchedPatterns: Array<{ pattern: string, weight: number }>,
 *   targetUrls: string[],
 * }}
 */
export function analyzeListener(fn) {
  const matchedPatterns = [];
  let totalWeight = 0;

  // Get function source
  let source;
  try {
    source = fn.toString();
  } catch {
    // Cross-origin or inaccessible function
    return { isHijack: false, confidence: 0, matchedPatterns: [], targetUrls: [] };
  }

  // Skip native functions
  if (source.includes('[native code]')) {
    return { isHijack: false, confidence: 0, matchedPatterns: [], targetUrls: [] };
  }

  // Test each pattern
  for (const pattern of HIJACK_PATTERNS) {
    if (pattern.regex.test(source)) {
      matchedPatterns.push({ pattern: pattern.label, weight: pattern.weight });
      totalWeight += pattern.weight;
    }
  }

  // Extract potential target URLs from the source
  const targetUrls = extractURLs(source);

  // Calculate confidence (0–100)
  // Patterns max out around 200+ weight, so we normalize
  const confidence = Math.min(100, Math.round(totalWeight * 1.5));

  return {
    isHijack: confidence >= 25,
    confidence,
    matchedPatterns,
    targetUrls,
  };
}

/**
 * Analyze multiple listeners on a single element.
 * @param {Array<{ type: string, fn: Function }>} listeners
 * @returns {{
 *   isHijacked: boolean,
 *   maxConfidence: number,
 *   listeners: Array<{ type: string, analysis: * }>,
 * }}
 */
export function analyzeElementListeners(listeners) {
  const results = listeners.map(l => ({
    type: l.type,
    analysis: analyzeListener(l.fn),
  }));

  const maxConfidence = Math.max(0, ...results.map(r => r.analysis.confidence));
  const hijackedResults = results.filter(r => r.analysis.isHijack);

  return {
    isHijacked: hijackedResults.length > 0,
    maxConfidence,
    listeners: results,
  };
}

/**
 * Quick check: does this event type warrant analysis?
 * @param {string} eventType
 * @returns {boolean}
 */
export function isRelevantEvent(eventType) {
  return HIJACK_EVENTS.includes(eventType);
}

// ─── URL Extraction ────────────────────────────────────────────────

/**
 * Naively extract URLs from a string (function source).
 * @param {string} source
 * @returns {string[]}
 */
function extractURLs(source) {
  const urls = new Set();

  // Match string literals that look like URLs
  const patterns = [
    /['"`](https?:\/\/[^'"`\s]+)['"`]/g,
    /['"`](\/\/[^'"`\s]+)['"`]/g,
    /location\s*=\s*['"`]([^'"`\s]+)['"`]/g,
    /window\.open\s*\(\s*['"`]([^'"`\s]+)['"`]/g,
    /assign\s*\(\s*['"`]([^'"`\s]+)['"`]/g,
    /replace\s*\(\s*['"`]([^'"`\s]+)['"`]/g,
  ];

  for (const pattern of patterns) {
    let match;
    pattern.lastIndex = 0;
    while ((match = pattern.exec(source)) !== null) {
      if (match[1]) urls.add(match[1]);
    }
  }

  return [...urls];
}
