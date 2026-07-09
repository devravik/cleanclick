/**
 * CleanClick - Hidden Link Scanner (Content Script)
 *
 * 🔴 CRITICAL MODULE
 *
 * Scans the DOM for invisible/obscured links that users cannot see
 * but can accidentally click. Detects 9 attack vectors:
 *
 * 1. Zero-opacity links
 * 2. Zero-size / 1px links
 * 3. Off-screen positioned links
 * 4. Font-size 0 links
 * 5. Color-matched links (text = background)
 * 6. Overflow-hidden links
 * 7. Z-index stacked links (multiple at same coordinates)
 * 8. Transparent overlay (clickjacking layer)
 * 9. Whitespace-only links
 *
 * Runs at document_idle after initial page render.
 */

import { HIDDEN_LINK, MSG } from '../shared/constants.js';
import { sendMessage } from '../shared/messaging.js';
import { classifyURL } from '../shared/link-classifier.js';

// ─── Detection Results ─────────────────────────────────────────────

/**
 * @typedef {Object} HiddenLinkReport
 * @property {string} tagName - e.g., 'A', 'AREA', 'BUTTON'
 * @property {string} href - The link destination
 * @property {string} hidingMethod - Which detection vector triggered
 * @property {Object} rect - bounding client rect
 * @property {string} selector - CSS selector for identification
 * @property {boolean} isOverlay - Is this a full-page transparent overlay?
 */

// ─── Main Scan ─────────────────────────────────────────────────────

/**
 * Scan the entire DOM for hidden links.
 * @returns {Promise<HiddenLinkReport[]>}
 */
export async function scanHiddenLinks() {
  const reports = [];

  // Collect all candidate elements
  const elements = document.querySelectorAll('a, area, button, div, iframe');

  for (const el of elements) {
    const report = analyzeElement(el);
    if (report) reports.push(report);
  }

  // Detect transparent overlays separately (they may not be <a> tags)
  const overlays = detectTransparentOverlays();
  reports.push(...overlays);

  // Send results to background
  if (reports.length > 0) {
    sendMessage(MSG.HIDDEN_LINKS_FOUND, {
      hiddenLinks: reports.map(r => ({ ...r, selector: undefined })), // don't send selectors to background
      count: reports.length,
      timestamp: Date.now(),
    }).catch(() => { });
  }

  return reports;
}

// ─── Element Analysis ──────────────────────────────────────────────

/**
 * Analyze a single element for hidden link characteristics.
 * @param {Element} el
 * @returns {HiddenLinkReport|null}
 */
function analyzeElement(el) {
  const tagName = el.tagName;
  const href = el.href || el.getAttribute('href') || el.getAttribute('action') || '';

  // Skip elements that aren't interactive
  if (!href && tagName !== 'DIV' && tagName !== 'IFRAME') return null;
  if (tagName === 'DIV' && !el.onclick) return null;
  if (tagName === 'IFRAME') return null; // handled separately

  const styles = getComputedStyle(el);
  const rect = el.getBoundingClientRect();
  const methods = [];

  // 1. Zero-opacity
  const opacity = parseFloat(styles.opacity);
  if (opacity < HIDDEN_LINK.OPACITY_THRESHOLD) {
    methods.push('zero-opacity');
  }

  // 2. Zero-size
  if (el.offsetWidth < HIDDEN_LINK.SIZE_THRESHOLD && el.offsetHeight < HIDDEN_LINK.SIZE_THRESHOLD) {
    methods.push('zero-size');
  }

  // 3. Off-screen
  if (rect.left < -100 || rect.top < -100 ||
    rect.right < 0 || rect.bottom < 0 ||
    rect.left > window.innerWidth + 100 ||
    rect.top > window.innerHeight + 100) {
    methods.push('off-screen');
  }

  // 4. Font-size 0
  if (styles.fontSize === '0px' || styles.fontSize === '0') {
    methods.push('font-size-zero');
  }

  // 5. Color matched
  const color = styles.color;
  const bgColor = styles.backgroundColor;
  if (color === bgColor && color !== 'rgba(0, 0, 0, 0)' && !color.includes('transparent')) {
    methods.push('color-matched');
  }

  // 6. Overflow hidden (element is clipped)
  if (styles.overflow === 'hidden' || styles.overflowX === 'hidden' || styles.overflowY === 'hidden') {
    // Check if element extends beyond its parent's visible area
    const parent = el.parentElement;
    if (parent) {
      const parentRect = parent.getBoundingClientRect();
      if (rect.width > parentRect.width * 1.5 || rect.height > parentRect.height * 1.5) {
        methods.push('overflow-hidden');
      }
    }
  }

  // 7. Z-index stacked (checked in group analysis below)

  // 9. Whitespace-only
  if (tagName === 'A' && el.textContent.trim() === '' && el.offsetWidth > 0 && el.offsetHeight > 0) {
    methods.push('whitespace-only');
  }

  if (methods.length === 0) return null;

  return {
    tagName,
    href: href || '(no href)',
    hidingMethod: methods.join(', '),
    rect: {
      left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom,
      width: rect.width, height: rect.height,
    },
    selector: buildSelector(el),
    isOverlay: false,
  };
}

// ─── Z-Index Stacking Detection ────────────────────────────────────

/**
 * Detect multiple links stacked at the same position (z-index burying).
 */
function detectZIndexStacking() {
  const reports = [];
  const grid = new Map();

  const links = document.querySelectorAll('a, area, button');
  for (const el of links) {
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) continue;

    // Determine grid cell
    const cellX = Math.floor((rect.left + rect.width / 2) / HIDDEN_LINK.STACK_GRID_SIZE);
    const cellY = Math.floor((rect.top + rect.height / 2) / HIDDEN_LINK.STACK_GRID_SIZE);
    const cellKey = `${cellX},${cellY}`;

    if (!grid.has(cellKey)) grid.set(cellKey, []);
    grid.get(cellKey).push({
      el,
      zIndex: parseInt(getComputedStyle(el).zIndex) || 0,
      rect,
    });
  }

  // For cells with multiple elements, check z-index ordering
  for (const [cellKey, items] of grid) {
    if (items.length < 2) continue;

    // Sort by z-index (ascending)
    items.sort((a, b) => a.zIndex - b.zIndex);

    // All but the topmost are hidden behind higher z-index elements
    for (let i = 0; i < items.length - 1; i++) {
      const item = items[i];
      const aboveItem = items[i + 1];

      // Check if the above item actually overlaps
      if (rectsOverlap(item.rect, aboveItem.rect)) {
        reports.push({
          tagName: item.el.tagName,
          href: item.el.href || '(no href)',
          hidingMethod: 'z-index-stacked',
          rect: item.rect,
          selector: buildSelector(item.el),
          isOverlay: false,
          details: `Z-index ${item.zIndex} behind ${aboveItem.zIndex}`,
        });
      }
    }
  }

  return reports;
}

function rectsOverlap(a, b) {
  return !(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom);
}

// ─── Transparent Overlay Detection ─────────────────────────────────

/**
 * Detect full-page transparent overlays (clickjacking).
 */
function detectTransparentOverlays() {
  const reports = [];
  const viewportArea = window.innerWidth * window.innerHeight;

  // Look for fixed/absolute positioned elements that cover most of the viewport
  const potentialOverlays = document.querySelectorAll('div, iframe, section, article, main');
  for (const el of potentialOverlays) {
    const styles = getComputedStyle(el);
    const rect = el.getBoundingClientRect();

    // Must be positioned fixed or absolute
    if (styles.position !== 'fixed' && styles.position !== 'absolute') continue;

    // Must cover >60% of viewport
    const area = rect.width * rect.height;
    if (area < viewportArea * HIDDEN_LINK.OVERLAY_COVERAGE_MIN) continue;

    // Must be transparent or nearly transparent
    const opacity = parseFloat(styles.opacity);
    const bgColor = styles.backgroundColor;

    // Skip legitimate overlays (high opacity, non-transparent background)
    if (opacity > 0.1 && !bgColor.includes('rgba(0, 0, 0, 0)')) continue;

    // Check z-index
    const zIndex = parseInt(styles.zIndex) || 0;
    if (zIndex < HIDDEN_LINK.OVERLAY_ZINDEX_MIN && el.children.length === 0) continue;

    // Check for onclick or event listeners that redirect
    const hasClickHandler = el.onclick !== null ||
      el.getAttribute('onclick') ||
      el.getAttribute('onmousedown');

    if (hasClickHandler || zIndex >= HIDDEN_LINK.OVERLAY_ZINDEX_MIN) {
      // Check if any child has a click handler
      let clickTarget = '';
      const children = el.querySelectorAll('[onclick], [onmousedown]');
      if (children.length > 0) {
        clickTarget = children[0].getAttribute('href') ||
          children[0].getAttribute('onclick') || '';
      }

      reports.push({
        tagName: el.tagName,
        href: clickTarget || '(overlay - intercepts all clicks)',
        hidingMethod: 'transparent-overlay',
        rect: {
          left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom,
          width: rect.width, height: rect.height
        },
        selector: buildSelector(el),
        isOverlay: true,
        details: `Z-index: ${zIndex}, covers ${Math.round(area / viewportArea * 100)}% of viewport`,
      });
    }
  }

  return reports;
}

// ─── Shadow DOM Traversal ──────────────────────────────────────────

/**
 * Recursively scan Shadow DOM roots for hidden links.
 * @param {ShadowRoot} shadowRoot
 * @returns {HiddenLinkReport[]}
 */
function scanShadowDOM(shadowRoot) {
  const reports = [];
  const elements = shadowRoot.querySelectorAll('a, area, button');

  for (const el of elements) {
    const report = analyzeElement(el);
    if (report) {
      report.selector = `${buildSelector(el)} (shadow DOM)`;
      reports.push(report);
    }
  }

  // Recurse into nested shadow roots
  const nestedHosts = shadowRoot.querySelectorAll(':host-context(*)');
  for (const host of nestedHosts) {
    if (host.shadowRoot) {
      reports.push(...scanShadowDOM(host.shadowRoot));
    }
  }

  return reports;
}

// ─── Build Selector Helper ─────────────────────────────────────────

function buildSelector(el) {
  if (el.id) return `#${CSS.escape(el.id)}`;
  if (el.className && typeof el.className === 'string') {
    const classes = el.className.trim().split(/\s+/).slice(0, 2);
    if (classes.length > 0 && classes[0]) {
      return el.tagName.toLowerCase() + '.' + classes.map(c => CSS.escape(c)).join('.');
    }
  }
  // Fallback: nth-of-type
  const parent = el.parentElement;
  if (parent) {
    const siblings = parent.querySelectorAll(el.tagName);
    const idx = Array.from(siblings).indexOf(el) + 1;
    return `${el.tagName.toLowerCase()}:nth-of-type(${idx})`;
  }
  return el.tagName.toLowerCase();
}

// ─── Public API ────────────────────────────────────────────────────

/**
 * Run a full hidden link scan on the current page.
 * Called on page load and can be triggered manually from the popup.
 */
export async function runFullScan() {
  const startTime = performance.now();

  // Phase 1: Standard element analysis
  const hiddenLinks = await scanHiddenLinks();

  // Phase 2: Z-index stacking detection
  const stacked = detectZIndexStacking();
  hiddenLinks.push(...stacked);

  // Phase 3: Shadow DOM
  if (document.body.shadowRoot) {
    const shadowLinks = scanShadowDOM(document.body.shadowRoot);
    hiddenLinks.push(...shadowLinks);
  }

  const duration = performance.now() - startTime;

  return {
    links: hiddenLinks,
    count: hiddenLinks.length,
    duration,
  };
}

// ─── Reveal Hidden Links ───────────────────────────────────────────

/**
 * Inject CSS to make hidden links visible to the user.
 */
export function revealHiddenLinks() {
  const style = document.createElement('style');
  style.id = 'cleanclick-reveal';
  style.textContent = `
    /* Reveal hidden links - injected by CleanClick */
    a[style*="opacity: 0"], a[style*="opacity:0"],
    [style*="opacity: 0"] a, [style*="opacity:0"] a {
      opacity: 1 !important;
      outline: 3px dashed #f00 !important;
      background: rgba(255, 0, 0, 0.05) !important;
    }
    a[style*="font-size: 0"], a[style*="font-size:0"] {
      font-size: 14px !important;
      outline: 3px dashed #f00 !important;
    }
    [style*="position: absolute"][style*="-9999px"],
    [style*="position:absolute"][style*="-9999px"] {
      position: static !important;
      outline: 3px dashed #f00 !important;
    }
    [style*="position: fixed"][style*="opacity: 0"],
    [style*="position:fixed"][style*="opacity:0"] {
      opacity: 0.1 !important;
      outline: 3px dashed #f00 !important;
      z-index: 2147483647 !important;
      pointer-events: none !important;
    }
  `;
  document.head.appendChild(style);
}

/**
 * Remove the reveal CSS.
 */
export function hideRevealedLinks() {
  const style = document.getElementById('cleanclick-reveal');
  if (style) style.remove();
}

// ─── Auto-init on idle ─────────────────────────────────────────────

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    requestIdleCallback(() => runFullScan(), { timeout: 3000 });
  });
} else {
  requestIdleCallback(() => runFullScan(), { timeout: 3000 });
}
