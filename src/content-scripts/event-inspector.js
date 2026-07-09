/**
 * CleanClick - Event Layer Inspector (Content Script)
 *
 * 🔴 CRITICAL MODULE
 *
 * Monitors all addEventListener calls on the page to detect
 * event listeners that hijack navigation (redirect on click,
 * mousedown override, auxclick hijack, etc.).
 *
 * Strategy:
 * Since Firefox does NOT expose getEventListeners(), we
 * monkey-patch EventTarget.prototype.addEventListener to
 * build a shadow registry of all registered listeners.
 *
 * Runs at document_start with world: "MAIN" so it captures
 * all page scripts' listener registrations.
 */

import { HIJACK_EVENTS, MSG, HIDDEN_LINK } from '../shared/constants.js';
import { analyzeListener, isRelevantEvent } from '../shared/event-analyzer.js';
import { sendMessage } from '../shared/messaging.js';

// ─── Shadow Registry ───────────────────────────────────────────────

/**
 * Map<Element, Map<EventType, Array<{ fn: Function, options: *, timestamp: number }>>>
 */
const shadowRegistry = new WeakMap();
let registrySize = 0;
const REGISTRY_LIMIT = HIDDEN_LINK.SHADOW_REGISTRY_LIMIT;

// ─── Monkey-patch addEventListener ─────────────────────────────────
// In some contexts (MAIN world, newer Firefox), EventTarget.prototype
// addEventListener is read-only. We try/catch to handle that gracefully.

let patchingFailed = false;
const originalAddEventListener = (() => {
  try { return EventTarget.prototype.addEventListener; } catch { patchingFailed = true; return null; }
})();
const originalRemoveEventListener = (() => {
  try { return EventTarget.prototype.removeEventListener; } catch { patchingFailed = true; return null; }
})();

function patchAddEventListener() {
  if (patchingFailed) return;
  try {
    EventTarget.prototype.addEventListener = function patchedAddEventListener(type, fn, options) {
    // Skip if we're past the limit
    if (registrySize >= REGISTRY_LIMIT) {
      return originalAddEventListener.call(this, type, fn, options);
    }

    // Track in shadow registry
    let typeMap = shadowRegistry.get(this);
    if (!typeMap) {
      typeMap = new Map();
      shadowRegistry.set(this, typeMap);
    }

    let listeners = typeMap.get(type);
    if (!listeners) {
      listeners = [];
      typeMap.set(type, listeners);
    }

    listeners.push({
      fn,
      options,
      timestamp: Date.now(),
    });
    registrySize++;

    // For relevant events, analyze immediately
    if (isRelevantEvent(type)) {
      const analysis = analyzeListener(fn);
      if (analysis.isHijack) {
        reportHijack(this, type, analysis);
      }
    }

    // Call original
    return originalAddEventListener.call(this, type, fn, options);
  };
  } catch (e) {
    console.warn('CleanClick: Failed to patch addEventListener:', e);
    patchingFailed = true;
  }
}

function patchRemoveEventListener() {
  if (patchingFailed) return;
  try {
    EventTarget.prototype.removeEventListener = function patchedRemoveEventListener(type, fn, options) {
    // Remove from shadow registry
    const typeMap = shadowRegistry.get(this);
    if (typeMap) {
      const listeners = typeMap.get(type);
      if (listeners) {
        const idx = listeners.findIndex(l => l.fn === fn);
        if (idx !== -1) {
          listeners.splice(idx, 1);
          registrySize--;
        }
        if (listeners.length === 0) {
          typeMap.delete(type);
        }
      }
      if (typeMap.size === 0) {
        shadowRegistry.delete(this);
      }
    }

    return originalRemoveEventListener.call(this, type, fn, options);
  };
  } catch (e) {
    console.warn('CleanClick: Failed to patch removeEventListener:', e);
  }
}

// ─── Query API ─────────────────────────────────────────────────────

/**
 * Get all tracked listeners for a specific element.
 * @param {Element} element
 * @returns {Array<{ type: string, fn: Function, options: * }>}
 */
function getListenersForElement(element) {
  const typeMap = shadowRegistry.get(element);
  if (!typeMap) return [];

  const result = [];
  for (const [type, listeners] of typeMap) {
    for (const l of listeners) {
      result.push({ type, fn: l.fn, options: l.options });
    }
  }
  return result;
}

/**
 * Get only hijack-relevant listeners for an element.
 * @param {Element} element
 * @returns {Array<{ type: string, fn: Function }>}
 */
function getRelevantListeners(element) {
  return getListenersForElement(element).filter(l => isRelevantEvent(l.type));
}

// ─── Reporting ─────────────────────────────────────────────────────

/**
 * Report a hijacked element to the background script.
 */
function reportHijack(element, eventType, analysis) {
  // element may be window, document, or other non-Element EventTarget
  const isElement = element && typeof element.getAttribute === 'function';
  const href = isElement ? (element.href || element.getAttribute('href') || '') : '';
  const selector = isElement ? buildSelector(element) : element.constructor?.name || 'unknown';

  sendMessage(MSG.EVENT_FLAG, {
    elementSelector: selector,
    href,
    tagName: element.tagName,
    eventType,
    confidence: analysis.confidence,
    matchedPatterns: analysis.matchedPatterns,
    targetUrls: analysis.targetUrls,
    timestamp: Date.now(),
  }).catch(() => {
    // Background may not be ready yet; queue is handled by coordinator
  });
}

/**
 * Build a CSS selector for an element (best-effort).
 * @param {Element} el
 * @returns {string}
 */
function buildSelector(el) {
  if (el.id) return `#${CSS.escape(el.id)}`;
  if (el.className && typeof el.className === 'string') {
    const classes = el.className.trim().split(/\s+/).slice(0, 3);
    if (classes.length > 0) {
      return el.tagName.toLowerCase() + classes.map(c => `.${CSS.escape(c)}`).join('');
    }
  }
  return el.tagName.toLowerCase();
}

// ─── Scan Existing Listeners on Page Load ──────────────────────────

/**
 * Walk the DOM and pre-populate the registry for any elements
 * that already have inline event handlers (onclick, onmousedown, etc.).
 * Note: We can't retroactively see listeners added before our patch ran,
 * but we can detect inline handlers.
 */
function scanInlineHandlers() {
  const elements = document.querySelectorAll('a, area, button, form, input[type="submit"]');
  for (const el of elements) {
    for (const eventType of HIJACK_EVENTS) {
      const attrName = `on${eventType}`;
      const handler = el[attrName];
      if (typeof handler === 'function') {
        // Simulate registration through our patched path
        // (We can't retroactively add to registry, but we can analyze directly)
        const analysis = analyzeListener(handler);
        if (analysis.isHijack) {
          reportHijack(el, eventType, analysis);
        }
      }
    }
  }
}

// ─── Public API for other content scripts ──────────────────────────

/**
 * Get the hijack status and details for a specific element.
 * Called by click-monitor.js before processing a click.
 * @param {Element} element
 * @returns {{ isHijacked: boolean, confidence: number, details: Array }}
 */
export function checkElementHijack(element) {
  const listeners = getRelevantListeners(element);
  if (listeners.length === 0) return { isHijacked: false, confidence: 0, details: [] };

  let maxConfidence = 0;
  const details = [];

  for (const l of listeners) {
    const analysis = analyzeListener(l.fn);
    if (analysis.confidence > maxConfidence) maxConfidence = analysis.confidence;
    if (analysis.isHijack) {
      details.push({
        eventType: l.type,
        patterns: analysis.matchedPatterns,
        confidence: analysis.confidence,
        targetUrls: analysis.targetUrls,
      });
    }
  }

  return {
    isHijacked: maxConfidence >= 25,
    confidence: maxConfidence,
    details,
  };
}

// ─── Init ──────────────────────────────────────────────────────────

export function init() {
  patchAddEventListener();
  patchRemoveEventListener();

  // Scan inline handlers once DOM is interactive
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scanInlineHandlers);
  } else {
    scanInlineHandlers();
  }
}

// Auto-init
init();
