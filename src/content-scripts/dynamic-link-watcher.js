/**
 * CleanClick - Dynamic Content Monitor (Content Script)
 *
 * 🟠 NEW MODULE
 *
 * Detects spam links injected after the initial page load via:
 * - MutationObserver for new elements
 * - Attribute change detection (href mutation)
 * - Text node URL scanning
 * - Shadow DOM traversal
 *
 * Integrates with hidden-link-scanner and link-verifier
 * to run scans on newly added elements.
 *
 * Runs at document_idle.
 */

import { TIMING, MSG } from '../shared/constants.js';
import { sendMessage } from '../shared/messaging.js';
import { checkElementHijack } from './event-inspector.js';

// ─── State ─────────────────────────────────────────────────────────

const state = {
  /** Map of seen element identifiers - used to detect changes */
  knownLinks: new Map(),
  /** Counter for total dynamic links detected */
  dynamicCount: 0,
  /** Timer for debouncing */
  debounceTimer: null,
  /** Whether observer is currently active */
  isActive: true,
  /** Timestamp when observer started */
  startedAt: Date.now(),
};

// ─── Shadow Registry Integration ───────────────────────────────────

/**
 * Build a stable identifier for an element to track it across mutations.
 */
function getElementId(el) {
  if (el.id) return `#${el.id}`;
  if (el.className && typeof el.className === 'string') {
    const cls = el.className.trim().split(/\s+/).slice(0, 2).join('.');
    if (cls) return `${el.tagName}.${cls}`;
  }
  // Use a path-based approach
  let path = el.tagName;
  let parent = el.parentElement;
  let depth = 0;
  while (parent && depth < 5) {
    const idx = Array.from(parent.children).indexOf(el) + 1;
    path = `${parent.tagName}>${path}:nth(${idx})`;
    parent = parent.parentElement;
    depth++;
  }
  return path;
}

// ─── MutationObserver Setup ───────────────────────────────────────

function setupObserver() {
  const observer = new MutationObserver((mutations) => {
    if (!state.isActive) return;

    // Debounce processing
    if (state.debounceTimer) clearTimeout(state.debounceTimer);
    state.debounceTimer = setTimeout(() => {
      processMutations(mutations);
    }, TIMING.OBSERVER_DEBOUNCE_MS);
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['href', 'action', 'data', 'src'],
  });

  // Auto-disconnect after max lifetime
  setTimeout(() => {
    state.isActive = false;
    observer.disconnect();
  }, TIMING.OBSERVER_MAX_LIFETIME_MS);

  return observer;
}

// ─── Mutation Processing ──────────────────────────────────────────

function processMutations(mutations) {
  const newLinks = [];
  const mutatedLinks = [];

  for (const mutation of mutations) {
    // New nodes added
    if (mutation.type === 'childList') {
      for (const node of mutation.addedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          // Scan the element itself if it's a link
          if (isLinkElement(node)) {
            const report = analyzeNewLink(node);
            if (report) newLinks.push(report);
          }
          // Scan descendants
          if (node.querySelectorAll) {
            const links = node.querySelectorAll('a[href], area[href], button, form');
            for (const link of links) {
              const report = analyzeNewLink(link);
              if (report) newLinks.push(report);
            }
          }
          // Shadow DOM
          if (node.shadowRoot) {
            scanShadowRoot(node.shadowRoot, newLinks);
          }
        }
      }
    }

    // Attribute changes (href mutation on existing elements)
    if (mutation.type === 'attributes') {
      const el = mutation.target;
      const oldValue = mutation.oldValue;
      const newValue = el.getAttribute(mutation.attributeName);

      if (isLinkElement(el) && oldValue !== newValue && oldValue) {
        const id = getElementId(el);
        // Check if this element was known with a different href
        if (state.knownLinks.has(id) && state.knownLinks.get(id) !== newValue) {
          mutatedLinks.push({
            element: el.tagName,
            id,
            oldHref: oldValue,
            newHref: newValue,
            timestamp: Date.now(),
          });
        }
        state.knownLinks.set(id, newValue);
      }
    }
  }

  // Report findings
  if (newLinks.length > 0 || mutatedLinks.length > 0) {
    state.dynamicCount += newLinks.length + mutatedLinks.length;

    sendMessage(MSG.DYNAMIC_LINKS, {
      links: newLinks,
      mutations: mutatedLinks,
      totalCount: state.dynamicCount,
      timestamp: Date.now(),
    }).catch(() => { });
  }
}

// ─── Link Analysis ────────────────────────────────────────────────

function isLinkElement(el) {
  if (!el || !el.tagName) return false;
  const tag = el.tagName.toLowerCase();
  return tag === 'a' || tag === 'area' || tag === 'button' || tag === 'form';
}

function analyzeNewLink(el) {
  const href = el.href || el.getAttribute('href') || el.getAttribute('action') || '';
  if (!href) return null;

  // Get identifier
  const id = getElementId(el);
  // Check if already known
  if (state.knownLinks.has(id)) {
    // Already seen - skip unless new href
    if (state.knownLinks.get(id) === href) return null;
  }
  state.knownLinks.set(id, href);

  // Run hijack check
  let hijackInfo = null;
  try {
    hijackInfo = checkElementHijack(el);
  } catch {
    // event-inspector not available
  }

  return {
    id,
    tagName: el.tagName,
    href,
    text: (el.textContent || '').trim().slice(0, 100),
    hijacked: hijackInfo?.isHijacked || false,
    hijackConfidence: hijackInfo?.confidence || 0,
    timestamp: Date.now(),
  };
}

// ─── Shadow DOM Scanning ──────────────────────────────────────────

function scanShadowRoot(root, results) {
  try {
    const links = root.querySelectorAll('a[href], area[href], button, form');
    for (const link of links) {
      const report = analyzeNewLink(link);
      if (report) {
        report.inShadowDOM = true;
        results.push(report);
      }
    }
    // Recurse into nested shadow roots
    const hosts = root.querySelectorAll('*');
    for (const host of hosts) {
      if (host.shadowRoot) {
        scanShadowRoot(host.shadowRoot, results);
      }
    }
  } catch {
    // Closed shadow root or cross-origin - skip
  }
}

// ─── Periodic Rescan ──────────────────────────────────────────────

/**
 * Periodically re-scan the entire DOM for links that may have been
 * injected via techniques that MutationObserver might miss
 * (e.g., direct innerHTML replacement).
 */
function startPeriodicRescan() {
  let scanCount = 0;

  const interval = setInterval(() => {
    scanCount++;
    if (scanCount > 10 || !state.isActive) {
      clearInterval(interval);
      return;
    }

    // Full DOM scan for new links
    const allLinks = document.querySelectorAll('a[href]');
    const newLinks = [];

    for (const link of allLinks) {
      const id = getElementId(link);
      const href = link.href;

      if (!state.knownLinks.has(id)) {
        state.knownLinks.set(id, href);
        const report = analyzeNewLink(link);
        if (report) newLinks.push(report);
      } else if (state.knownLinks.get(id) !== href) {
        // Href changed
        state.knownLinks.set(id, href);
        newLinks.push({
          id,
          tagName: link.tagName,
          href,
          text: (link.textContent || '').trim().slice(0, 100),
          isMutation: true,
          timestamp: Date.now(),
        });
      }
    }

    if (newLinks.length > 0) {
      state.dynamicCount += newLinks.length;
      sendMessage(MSG.DYNAMIC_LINKS, {
        links: newLinks,
        totalCount: state.dynamicCount,
        timestamp: Date.now(),
        fromPeriodicScan: true,
      }).catch(() => { });
    }
  }, 3000); // Every 3 seconds for first 30 seconds
}

// ─── Text Node URL Detection ──────────────────────────────────────

/**
 * Detect URLs in newly added text nodes that might become auto-linked.
 */
function scanTextNodesForURLs(text) {
  const urlPattern = /https?:\/\/[^\s<>"']+/g;
  const matches = [];
  let match;
  while ((match = urlPattern.exec(text)) !== null) {
    matches.push(match[0]);
  }
  return matches;
}

// ─── Init ─────────────────────────────────────────────────────────

export function init() {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setupObserver();
      startPeriodicRescan();
    });
  } else {
    setupObserver();
    startPeriodicRescan();
  }
}

// Auto-init
init();
