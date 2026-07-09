/**
 * CleanClick — Popup Blocker (Content Script)
 *
 * Prevents unwanted popup windows by intercepting window.open()
 * and monitoring for suspicious popup patterns.
 *
 * Also handles the background half: closing unwanted popup tabs
 * that bypassed the content script intercept.
 *
 * Runs at document_start with world: "MAIN".
 */

import { MSG } from '../shared/constants.js';

// ─── Override window.open ──────────────────────────────────────────

const originalWindowOpen = window.open;

/**
 * Check if a popup URL is suspicious.
 * @param {string} url
 * @param {string} currentOrigin
 * @returns {{ isSuspicious: boolean, reason: string }}
 */
function checkPopupURL(url, currentOrigin) {
  try {
    const targetUrl = new URL(url, window.location.href);
    const currentUrl = new URL(currentOrigin);

    // 1. No user gesture check — we're in the intercept so we can check
    //    if we're inside a trusted event handler (see below)

    // 2. Cross-origin with more than 2 TLD difference
    const targetParts = targetUrl.hostname.split('.');
    const currentParts = currentUrl.hostname.split('.');
    if (targetParts.length - currentParts.length > 1) {
      return { isSuspicious: true, reason: 'Deeply nested domain differs from origin' };
    }

    // 3. Known ad/malware pattern
    const suspiciousPatterns = [
      /pop(up|under)/i, /adserver/, /click(ad|s?)/i,
      /traffic/, /redirect/i, /affiliate/i,
      /sponsor/i, /promo/i, /banner/i,
    ];

    for (const pattern of suspiciousPatterns) {
      if (pattern.test(targetUrl.hostname) || pattern.test(targetUrl.pathname)) {
        return { isSuspicious: true, reason: `URL matches suspicious pattern: ${pattern}` };
      }
    }

    // 4. URL shortener in popup — suspicious
    const shorteners = ['bit.ly', 'tinyurl.com', 'ow.ly', 'is.gd', 't.co', 'goo.gl'];
    if (shorteners.some(s => targetUrl.hostname.includes(s))) {
      return { isSuspicious: true, reason: 'Popup uses URL shortener' };
    }

    return { isSuspicious: false, reason: '' };
  } catch {
    return { isSuspicious: true, reason: 'Invalid URL' };
  }
}

/**
 * Track whether we're inside a user-initiated event handler.
 */
let insideUserGesture = false;

// Set gesture flag on real user events (capture phase, before any handlers)
document.addEventListener('click', () => { insideUserGesture = true; }, true);
document.addEventListener('mousedown', () => { insideUserGesture = true; }, true);
document.addEventListener('touchstart', () => { insideUserGesture = true; }, true);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') insideUserGesture = true;
}, true);

// Reset gesture flag after events settle
function resetGestureFlag() {
  setTimeout(() => { insideUserGesture = false; }, 300);
}
document.addEventListener('click', resetGestureFlag, false);
document.addEventListener('mousedown', resetGestureFlag, false);

// ─── Intercept window.open ─────────────────────────────────────────

window.open = function interceptedOpen(url, name, features) {
  const check = checkPopupURL(url || '', window.location.origin);
  const isUserInitiated = insideUserGesture;

  // Block if:
  // 1. Not user-initiated AND looks suspicious
  // 2. Known pop-under patterns (no name, hidden features)
  const shouldBlock = (!isUserInitiated && check.isSuspicious) ||
    (check.isSuspicious && features?.includes('hidden=yes')) ||
    (check.reason && !isUserInitiated);

  if (shouldBlock) {
    // Log to background
    browser.runtime.sendMessage({
      type: MSG.POPUP_BLOCKED,
      payload: {
        url: url,
        reason: check.reason,
        hadUserGesture: isUserInitiated,
        timestamp: Date.now(),
      },
    }).catch(() => {});

    // Return a reference to a dummy window
    const dummy = { closed: true, location: null, focus: () => {}, close: () => {} };
    return dummy;
  }

  // Allow the popup, but log it
  browser.runtime.sendMessage({
    type: 'popup:allowed',
    payload: { url, name, features, hadUserGesture: isUserInitiated },
  }).catch(() => {});

  return originalWindowOpen.call(window, url, name, features);
};

// ─── Background: Close Unwanted Popup Tabs ─────────────────────────

/**
 * Background-side popup blocker logic.
 * Called from background/index.js.
 */
export class PopupBlockerBackground {
  constructor() {
    this.recentPopups = new Map(); // tabId -> { openedAt, url, byCleanClick }
  }

  /**
   * Monitor newly created tabs and close unwanted ones.
   */
  onTabCreated(tab) {
    // If tab was opened without user gesture (from background context),
    // it might be a popup we couldn't intercept
    if (tab.url === 'about:blank' && tab.openerTabId) {
      // Give it a moment to see if it navigates to something
      setTimeout(() => {
        browser.tabs.get(tab.id).then(updatedTab => {
          if (!updatedTab || updatedTab.url === 'about:blank') return;
          this.evaluateNewTab(updatedTab);
        }).catch(() => {});
      }, 300);
    }
  }

  /**
   * Evaluate whether a newly opened tab should be closed.
   */
  async evaluateNewTab(tab) {
    try {
      const openerTab = await browser.tabs.get(tab.openerTabId);

      // Check if different domain from opener
      const openerDomain = new URL(openerTab.url).hostname;
      const tabDomain = new URL(tab.url).hostname;

      if (openerDomain !== tabDomain) {
        const suspiciousPatterns = [
          /pop(up|under)/i, /adserver/, /click(ad|s?)/i,
          /traffic/i, /redirect/i,
        ];

        for (const pattern of suspiciousPatterns) {
          if (pattern.test(tabDomain) || pattern.test(tab.url)) {
            // Close it
            await browser.tabs.remove(tab.id);

            // Log to statistics
            const { storage } = await import('../shared/storage.js');
            await storage.incrementStat('popupsPrevented');

            // Show notification
            browser.notifications.create({
              type: 'basic',
              iconUrl: browser.runtime.getURL('assets/icons/icon-48.png'),
              title: 'CleanClick',
              message: `Blocked unwanted popup: ${tabDomain}`,
            });
            return;
          }
        }
      }
    } catch (err) {
      // Tab may have already closed
    }
  }
}
