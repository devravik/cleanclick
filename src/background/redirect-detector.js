/**
 * CleanClick — Smart Redirect Detector (Background Script)
 *
 * Monitors all navigation events via webNavigation API,
 * correlates them with recorded click contexts, detects
 * suspicious redirects, and blocks them.
 *
 * Also receives event hijack flags from the event-inspector
 * to bolster detection confidence.
 */

import { TIMING, MSG } from '../shared/constants.js';
import { onMessage } from '../shared/messaging.js';
import storage from '../shared/storage.js';

// ─── State ─────────────────────────────────────────────────────────

/**
 * Map<tabId, { clickContext, timestamp }>
 * Recent click contexts, expired after TIMING.CLICK_TO_NAV_MAX ms
 */
const clickContexts = new Map();

/**
 * Map<tabId, { url, timestamp }[]>
 * Redirect chains per tab
 */
const redirectChains = new Map();

/**
 * Map<tabId, Set<selector>>
 * Flagged elements from event-inspector
 */
const flaggedElements = new Map();

// ─── Click Context Recording ───────────────────────────────────────

/**
 * Record a click context for correlation with navigation events.
 * Called via messaging from click-monitor content script.
 * @param {Object} context
 * @param {Object} [hijackInfo]
 * @param {number} tabId
 */
export function recordClick(context, hijackInfo, tabId) {
  clickContexts.set(tabId, {
    context,
    hijackInfo: hijackInfo || null,
    timestamp: Date.now(),
  });

  // If event inspector flagged this element, store it
  if (hijackInfo && hijackInfo.isHijacked) {
    const flags = flaggedElements.get(tabId) || new Set();
    flags.add(context.href);
    flaggedElements.set(tabId, flags);
  }
}

// ─── Navigation Monitoring ─────────────────────────────────────────

/**
 * Handle navigation events.
 * @param {Object} details - webNavigation event details
 */
export function onNavigation(details) {
  // Only track top-frame navigations
  if (details.frameId !== 0) return;

  const { tabId, url, timeStamp } = details;

  // Ignore extension pages, about: pages
  if (url.startsWith('moz-extension://') || url.startsWith('about:')) return;

  // Check if we have a recent click context for this tab
  const clickRecord = clickContexts.get(tabId);
  const timeSinceClick = clickRecord ? timeStamp - clickRecord.timestamp : Infinity;

  // Check for redirect chain
  let chain = redirectChains.get(tabId) || [];
  chain.push({ url, timestamp: timeStamp });
  redirectChains.set(tabId, chain);

  // Determine if this navigation is suspicious
  const decision = analyzeNavigation(tabId, url, timeStamp, clickRecord, timeSinceClick, chain);

  if (decision.shouldBlock) {
    executeBlock(tabId, decision);
  }
}

/**
 * Analyze a navigation event and decide whether to block.
 * @returns {{ shouldBlock: boolean, reason: string, confidence: number }}
 */
function analyzeNavigation(tabId, url, timeStamp, clickRecord, timeSinceClick, chain) {
  // 1. No click context → potentially suspicious (popup / auto-redirect)
  if (!clickRecord) {
    // Check if there's a flagged element for this tab
    const flags = flaggedElements.get(tabId);
    if (flags && flags.size > 0) {
      return { shouldBlock: true, reason: 'Auto-redirect with prior hijack flags', confidence: 70 };
    }
    // Popup/new tab with no user gesture
    return { shouldBlock: false, reason: 'No click context — monitoring', confidence: 10 };
  }

  const { context, hijackInfo } = clickRecord;
  const intendedUrl = context.href;

  // 2. Timing check
  if (timeSinceClick < TIMING.CLICK_TO_NAV_MIN) {
    // Too fast — likely auto-redirect not user-initiated
    return { shouldBlock: true, reason: 'Navigation too fast after click (<100ms)', confidence: 60 };
  }

  if (timeSinceClick > TIMING.CLICK_TO_NAV_MAX) {
    // Too slow — click is stale, but could be a delayed redirect
    return { shouldBlock: false, reason: 'Click too old — possibly unrelated', confidence: 5 };
  }

  // 3. Destination matches intended URL → safe
  if (url === intendedUrl || url.startsWith(intendedUrl.split('#')[0])) {
    return { shouldBlock: false, reason: 'Navigation matches intended destination', confidence: 0 };
  }

  // 4. Check for event hijack flag
  if (hijackInfo && hijackInfo.isHijacked) {
    const isHighConfidence = hijackInfo.confidence >= 50;
    return {
      shouldBlock: isHighConfidence,
      reason: isHighConfidence
        ? `Event hijack detected (confidence: ${hijackInfo.confidence}%)`
        : 'Low-confidence hijack detected',
      confidence: hijackInfo.confidence,
    };
  }

  // 5. Check if destination is in whitelist
  // (async — called separately with the result)

  // 6. Redirect chain check
  if (chain.length >= TIMING.RAPID_REDIRECT_HOPS) {
    const timeSpan = chain[chain.length - 1].timestamp - chain[0].timestamp;
    if (timeSpan < TIMING.RAPID_REDIRECT_WINDOW) {
      return { shouldBlock: true, reason: `Rapid redirect chain (${chain.length} hops in ${timeSpan}ms)`, confidence: 75 };
    }
  }

  // 7. Same domain navigation — likely safe
  try {
    const intendedDomain = new URL(intendedUrl).hostname;
    const actualDomain = new URL(url).hostname;
    if (intendedDomain === actualDomain) {
      return { shouldBlock: false, reason: 'Same-domain navigation', confidence: 0 };
    }
  } catch {
    // URL parsing failed — could be suspicious
  }

  return { shouldBlock: false, reason: 'No strong indicators', confidence: 10 };
}

// ─── Blocking Actions ──────────────────────────────────────────────

/**
 * Execute a block decision.
 */
async function executeBlock(tabId, decision) {
  try {
    // Close the tab (for popups) or navigate back
    const tab = await browser.tabs.get(tabId);
    if (tab) {
      // If it's a newly opened tab (popup), close it
      if (tab.openerTabId) {
        await browser.tabs.remove(tabId);
        // Focus the opener tab
        await browser.tabs.update(tab.openerTabId, { active: true });

        // Log to statistics
        await storage.incrementStat('redirectsBlocked');

        // Show notification
        browser.notifications.create({
          type: 'basic',
          iconUrl: browser.runtime.getURL('assets/icons/icon-48.png'),
          title: 'CleanClick',
          message: `Blocked a suspicious redirect: ${decision.reason}`,
        });
      }
    }
  } catch (err) {
    console.warn('Failed to block redirect:', err);
  }
}

// ─── Tab Cleanup ───────────────────────────────────────────────────

function cleanupTab(tabId) {
  clickContexts.delete(tabId);
  redirectChains.delete(tabId);
  flaggedElements.delete(tabId);
}

// ─── Init ──────────────────────────────────────────────────────────

export function init() {
  // Listen for navigation events
  browser.webNavigation.onCommitted.addListener(onNavigation);
  browser.webNavigation.onCreatedNavigationTarget.addListener((details) => {
    // Track popup windows
    if (details.sourceTabId) {
      const clickRecord = clickContexts.get(details.sourceTabId);
      if (clickRecord) {
        clickContexts.set(details.tabId, {
          context: clickRecord.context,
          hijackInfo: null,
          timestamp: Date.now(),
        });
      }
    }
  });

  // Cleanup on tab close
  browser.tabs.onRemoved.addListener(cleanupTab);

  // Handle click context messages from content scripts
  onMessage(MSG.CLICK_RECORDED, (payload, sender) => {
    const tabId = sender.tab?.id;
    if (!tabId) return;
    recordClick(payload.context, payload.hijackInfo, tabId);
    return { ok: true };
  });

  // Handle event flag messages from event-inspector
  onMessage(MSG.EVENT_FLAG, (payload, sender) => {
    const tabId = sender.tab?.id;
    if (!tabId) return;
    const flags = flaggedElements.get(tabId) || new Set();
    flags.add(payload.href);
    flaggedElements.set(tabId, flags);
    return { ok: true };
  });
}
