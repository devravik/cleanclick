/**
 * CleanClick - Scam Overlay Detector (Content Script)
 *
 * 🟠 NEW MODULE
 *
 * Detects social engineering overlays:
 * - Fake virus warnings ("Your computer is infected!")
 * - Prize scams ("You have won!")
 * - Fake CAPTCHA overlays
 * - Fake close buttons that redirect instead of closing
 * - Full-screen clickjacking overlays
 *
 * Runs at document_idle.
 */

import { HIDDEN_LINK, SCAM_PHRASES, MSG } from '../shared/constants.js';
import { sendMessage } from '../shared/messaging.js';
import { setHTML } from '../shared/i18n.js';

// ─── State ─────────────────────────────────────────────────────────

const state = {
  /** Detected overlays in current session */
  overlays: [],
  /** Whether we've already warned for this page */
  hasWarned: false,
  /** MutationObserver instance */
  observer: null,
};

// ─── Overlay Detection ────────────────────────────────────────────

/**
 * Check if an element qualifies as a suspicious overlay.
 */
function isSuspiciousOverlay(el) {
  const tag = el.tagName.toLowerCase();
  if (tag === 'html' || tag === 'body') return false;

  const styles = window.getComputedStyle(el);
  const rect = el.getBoundingClientRect();
  const viewportArea = window.innerWidth * window.innerHeight;
  const elArea = rect.width * rect.height;

  // Must be fixed or absolute positioned
  if (styles.position !== 'fixed' && styles.position !== 'absolute') return false;

  // Must cover a significant portion of the viewport
  const coverage = elArea / viewportArea;
  if (coverage < HIDDEN_LINK.OVERLAY_COVERAGE_MIN) return false;

  // Must have high z-index (appears on top of everything)
  const zIndex = parseInt(styles.zIndex) || 0;

  return zIndex >= HIDDEN_LINK.OVERLAY_ZINDEX_MIN || coverage > 0.8;
}

// ─── Scam Text Analysis ───────────────────────────────────────────

/**
 * Analyze the text content of an overlay for scam phrases.
 */
function analyzeScamText(text) {
  if (!text) return { isScam: false, matchedPhrases: [], score: 0 };

  const matched = [];
  for (const pattern of SCAM_PHRASES) {
    if (pattern.test(text)) {
      matched.push(pattern.source);
    }
  }

  return {
    isScam: matched.length > 0,
    matchedPhrases: matched,
    score: matched.length,
  };
}

// ─── Fake Close Button Detection ──────────────────────────────────

/**
 * Check if buttons within an overlay are fake close buttons that redirect.
 */
function analyzeButtons(overlay) {
  const buttons = overlay.querySelectorAll('button, a, [onclick], [role="button"]');
  const issues = [];

  for (const btn of buttons) {
    const text = (btn.textContent || '').trim().toLowerCase();
    const isCloseLabel = /^[✕×✖🗕🗙x⨯]|close|cancel|dismiss|no\s*thanks/i.test(text);

    if (!isCloseLabel) continue;

    // Check if clicking this redirects
    const onclick = btn.getAttribute('onclick') || '';
    const href = btn.getAttribute('href') || '';

    if (onclick.includes('location') || onclick.includes('window.open') ||
      (href && href !== '#' && !href.startsWith('javascript:void'))) {
      issues.push({
        buttonText: text.slice(0, 50),
        action: onclick || href,
        type: 'redirect-on-close',
      });
    }
  }

  // Check if clicking the overlay background (outside any button) triggers navigation
  const overlayOnClick = overlay.getAttribute('onclick') || '';
  if (overlayOnClick.includes('location') || overlayOnClick.includes('window.open')) {
    issues.push({
      buttonText: '(background click)',
      action: overlayOnClick,
      type: 'background-click-redirect',
    });
  }

  return issues;
}

// ─── Main Detection Logic ─────────────────────────────────────────

function detectOverlay(el) {
  if (!isSuspiciousOverlay(el)) return null;

  const text = el.textContent || '';
  const scamAnalysis = analyzeScamText(text);

  // Always check buttons, even if text doesn't match scam phrases
  const buttonIssues = analyzeButtons(el);

  if (!scamAnalysis.isScam && buttonIssues.length === 0) return null;

  const rect = el.getBoundingClientRect();
  const zIndex = parseInt(window.getComputedStyle(el).zIndex) || 0;

  return {
    tagName: el.tagName,
    selector: buildSelector(el),
    scamScore: scamAnalysis.score,
    matchedPhrases: scamAnalysis.matchedPhrases,
    buttonIssues,
    zIndex,
    coverage: Math.round((rect.width * rect.height) / (window.innerWidth * window.innerHeight) * 100),
    rect: { width: rect.width, height: rect.height },
    textPreview: text.slice(0, 200),
    timestamp: Date.now(),
  };
}

// ─── Observer Setup ───────────────────────────────────────────────

function setupObserver() {
  state.observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const result = detectOverlay(node);
          if (result) {
            handleDetectedOverlay(result);
          }
          // Check descendants
          if (node.querySelectorAll) {
            const candidates = node.querySelectorAll('div, section, article, aside, main');
            for (const candidate of candidates) {
              const result = detectOverlay(candidate);
              if (result) handleDetectedOverlay(result);
            }
          }
        }
      }
    }
  });

  state.observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
}

// ─── Handle Detection ─────────────────────────────────────────────

function handleDetectedOverlay(result) {
  // Avoid duplicate warnings
  if (state.overlays.some(o => o.selector === result.selector)) return;

  state.overlays.push(result);

  if (!state.hasWarned) {
    state.hasWarned = true;
    showOverlayWarning(result);
  }

  // Log to background
  sendMessage(MSG.SCAM_OVERLAY, {
    ...result,
    pageUrl: window.location.href,
  }).catch(() => { });
}

// ─── User Warning UI ──────────────────────────────────────────────

function showOverlayWarning(result) {
  const warning = document.createElement('div');
  warning.id = 'cleanclick-scam-warning';
  warning.style.cssText = `
    position: fixed;
    top: 0; left: 0; right: 0;
    z-index: 2147483647;
    background: #d32f2f;
    color: white;
    padding: 12px 20px;
    font-family: -apple-system, system-ui, sans-serif;
    font-size: 14px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    display: flex;
    align-items: center;
    gap: 12px;
  `;

  let details = '';
  if (result.matchedPhrases.length > 0) {
    details += `<div style="font-size:12px;margin-top:4px;opacity:0.9">Detected: ${result.matchedPhrases.join(', ')}</div>`;
  }
  if (result.buttonIssues.length > 0) {
    details += `<div style="font-size:12px;margin-top:4px;opacity:0.9">Fake close button detected</div>`;
  }

  const _html = `    <span style="font-size:24px">!</span>
    <div style="flex:1">
      <strong>Suspicious overlay detected!</strong>
      ${details}
    </div>
    <button id="cleanclick-remove-overlay" style="
      padding:8px 16px; background:white; color:#d32f2f;
      border:none; border-radius:4px; cursor:pointer; font-weight:600;
    ">Remove Overlay</button>
    <button id="cleanclick-dismiss-warning" style="
      padding:8px 12px; background:transparent; color:white;
      border:1px solid rgba(255,255,255,0.5); border-radius:4px; cursor:pointer;
    ">Dismiss</button>
  `;
  setHTML(warning, _html);

  document.body.prepend(warning);

  document.getElementById('cleanclick-remove-overlay').onclick = removeSuspiciousOverlay;
  document.getElementById('cleanclick-dismiss-warning').onclick = () => warning.remove();
}

/**
 * Find and remove the suspicious overlay from the DOM.
 */
function removeSuspiciousOverlay() {
  // Find the highest-z-index fixed element that we flagged
  const candidates = document.querySelectorAll('div, section, article, aside, main');
  let bestCandidate = null;
  let bestZIndex = -1;

  for (const el of candidates) {
    const styles = window.getComputedStyle(el);
    if (styles.position !== 'fixed' && styles.position !== 'absolute') continue;
    const zIndex = parseInt(styles.zIndex) || 0;
    if (zIndex > bestZIndex) {
      // Check if it's likely the scam overlay (has the scam phrases)
      const text = el.textContent || '';
      for (const pattern of SCAM_PHRASES) {
        if (pattern.test(text)) {
          bestCandidate = el;
          bestZIndex = zIndex;
          break;
        }
      }
    }
  }

  if (bestCandidate) {
    bestCandidate.style.display = 'none';
    bestCandidate.style.visibility = 'hidden';
    bestCandidate.style.pointerEvents = 'none';
    // Restore body scroll
    document.body.style.overflow = '';
    document.body.style.position = '';
  }

  const warning = document.getElementById('cleanclick-scam-warning');
  if (warning) {
    const _html = `      <span style="font-size:20px">[OK]</span>
      <span>Overlay removed. Page should now be usable.</span>
      <button style="margin-left:auto;padding:4px 12px;background:transparent;color:white;border:1px solid rgba(255,255,255,0.5);border-radius:4px;cursor:pointer"
              onclick="this.parentElement.remove()">OK</button>
    `;
    setHTML(warning, _html);
  }
}

// ─── Initial Scan ─────────────────────────────────────────────────

function scanExistingElements() {
  const candidates = document.querySelectorAll('div, section, article, aside, main');
  for (const el of candidates) {
    const result = detectOverlay(el);
    if (result) {
      handleDetectedOverlay(result);
    }
  }
}

// ─── Utilities ────────────────────────────────────────────────────

function buildSelector(el) {
  if (el.id) return `#${CSS.escape(el.id)}`;
  if (el.className && typeof el.className === 'string') {
    const classes = el.className.trim().split(/\s+/).slice(0, 2);
    if (classes.length > 0 && classes[0]) {
      return el.tagName.toLowerCase() + '.' + classes.map(c => CSS.escape(c)).join('.');
    }
  }
  return el.tagName.toLowerCase() + '_' + Math.random().toString(36).slice(2, 8);
}

// ─── Init ─────────────────────────────────────────────────────────

export function init() {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      scanExistingElements();
      setupObserver();
    });
  } else {
    scanExistingElements();
    setupObserver();
  }
}

// Auto-init
init();
