/**
 * CleanClick - Click Monitor (Content Script)
 *
 * Records every click on <a>, <area>, and <button> elements.
 * Captures context (intended href, link text, timestamp, position)
 * and sends it to the background script for redirect correlation.
 *
 * Also checks with event-inspector.js for hijack flags before
 * allowing navigation to proceed.
 *
 * Runs at document_start with world: "MAIN".
 */

import { MSG, TIMING } from '../shared/constants.js';
import { sendMessage } from '../shared/messaging.js';
import { setHTML } from '../shared/i18n.js';
import { checkElementHijack } from './event-inspector.js';

// ─── State ─────────────────────────────────────────────────────────

let tabId = null;

// ─── Click Handler ─────────────────────────────────────────────────

/**
 * Handle click events on navigation elements.
 */
function handleClick(event) {
  // Find the anchor/area element from the event target
  const link = findClosestLink(event.target);
  if (!link) return;

  const href = link.href || link.getAttribute('href') || '';
  if (!href || href.startsWith('javascript:')) return;

  // Build click context
  const context = {
    href,
    linkText: (link.textContent || '').trim().slice(0, 200),
    // Convert MouseEvent properties to plain JSON-safe values
    clientX: event.clientX,
    clientY: event.clientY,
    button: event.button,
    buttons: event.buttons,
    ctrlKey: event.ctrlKey,
    shiftKey: event.shiftKey,
    metaKey: event.metaKey,
    altKey: event.altKey,
    timestamp: Date.now(),
    tagName: link.tagName,
    // Which frame is this click happening in?
    frameId: getFrameId(),
  };

  // Check with event inspector for hijack flags
  let hijackInfo = null;
  try {
    hijackInfo = checkElementHijack(link);
  } catch (err) {
    // event-inspector may not be initialized yet in some edge cases
  }

  // Send to background (fire-and-forget, don't block the click)
  sendMessage(MSG.CLICK_RECORDED, {
    context,
    hijackInfo,
  }).catch(() => {
    // Background may not respond - click proceeds regardless
  });

  // If hijacked with high confidence, show warning
  if (hijackInfo && hijackInfo.isHijacked && hijackInfo.confidence >= 50) {
    showHijackWarning(hijackInfo);
  }
}

/**
 * Find the closest <a> or <area> ancestor from a target element.
 * Handles cases where the click lands on a child element (e.g., <span>, <img> inside an <a>).
 * @param {Element} target
 * @returns {HTMLAnchorElement|HTMLAreaElement|null}
 */
function findClosestLink(target) {
  // Is the target itself a link?
  if (target.tagName === 'A' || target.tagName === 'AREA') return target;

  // Is there an <a> ancestor?
  const anchor = target.closest('a');
  if (anchor) return anchor;

  // Is there an <area> ancestor?
  const area = target.closest('area');
  if (area) return area;

  // Is the target a <button> or <input type="submit">?
  if (target.tagName === 'BUTTON' ||
    (target.tagName === 'INPUT' && target.type === 'submit')) {
    // Buttons navigate via form action; store the form action if available
    const form = target.closest('form');
    if (form && form.action) {
      return { href: form.action, tagName: 'FORM', textContent: target.textContent };
    }
    return null;
  }

  return null;
}

/**
 * Get the current frame ID (0 for top frame, >0 for iframes).
 * @returns {number}
 */
function getFrameId() {
  try {
    if (window.self !== window.top) {
      // We're in an iframe - best-effort detection
      return 1; // Simplified; real frameId requires browser API
    }
  } catch (e) {
    // Cross-origin iframe - can't access
    return -1;
  }
  return 0;
}

// ─── Hijack Warning UI ─────────────────────────────────────────────

/**
 * Show an in-page warning banner when a hijacked link is clicked.
 */
function showHijackWarning(hijackInfo) {
  // Don't show if already warned recently
  if (document.getElementById('cleanclick-hijack-warning')) return;

  const banner = document.createElement('div');
  banner.id = 'cleanclick-hijack-warning';
  banner.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 2147483647;
    background: #fff3cd;
    color: #856404;
    padding: 12px 20px;
    font-family: -apple-system, system-ui, sans-serif;
    font-size: 14px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    display: flex;
    align-items: center;
    gap: 12px;
  `;
  const _html = `    <span style="font-size:20px">!</span>
    <span><strong>CleanClick:</strong> This link was hijacked!
      The page script redirected to: <code>${hijackInfo.details[0]?.targetUrls?.[0] || 'unknown'}</code>
    </span>
    <button style="margin-left:auto;padding:6px 16px;background:#856404;color:white;border:none;border-radius:4px;cursor:pointer"
            onclick="this.parentElement.remove()">Dismiss</button>
  `;
  setHTML(banner, _html);

  document.body.prepend(banner);

  // Auto-dismiss after 8 seconds
  setTimeout(() => {
    const el = document.getElementById('cleanclick-hijack-warning');
    if (el) el.remove();
  }, 8000);
}

// ─── Pointer Events for Hover Tracking ─────────────────────────────

/**
 * Track mouseover to detect href mutations between hover and click.
 */
let lastHoveredHref = null;
let hoveredElement = null;

document.addEventListener('mouseover', (event) => {
  const link = findClosestLink(event.target);
  if (link && link.href) {
    hoveredElement = link;
    lastHoveredHref = link.href;
  }
}, true);

// Expose for link-verifier.js to use
window.__cleanClick = window.__cleanClick || {};
window.__cleanClick.getHoverState = () => ({
  element: hoveredElement,
  hrefAtHover: lastHoveredHref,
});

// ─── Init ──────────────────────────────────────────────────────────

/**
 * Initialize the click monitor.
 */
export function init() {
  // Get tab ID from background via messaging
  browser.runtime.sendMessage({ type: 'get:tab-info' }).then(response => {
    if (response && response.tabId) tabId = response.tabId;
  }).catch(() => { });

  // Register click handlers (capture phase to catch events before page scripts)
  document.addEventListener('click', handleClick, true);
  document.addEventListener('auxclick', handleClick, true); // Middle-click
  document.addEventListener('mousedown', handleClick, true); // Track mousedown too
}

// Auto-init
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
