/**
 * CleanClick - Event Coordinator (Background Script)
 *
 * Receives event analysis reports from content scripts (event-inspector),
 * maintains per-tab state of flagged elements, aggregates statistics,
 * and forwards critical flags to redirect-detector for correlation.
 *
 * Acts as the central nervous system between content-side detection
 * and background-side blocking.
 */

import { MSG, HIDDEN_LINK } from '../shared/constants.js';
import { onMessage, sendToTab } from '../shared/messaging.js';
import storage from '../shared/storage.js';
import { PopupBlockerBackground } from '../content-scripts/popup-blocker.js';
import { init as initRedirectDetector, recordClick } from './redirect-detector.js';

// ─── State ─────────────────────────────────────────────────────────

/**
 * Per-tab state.
 * Map<tabId, {
 *   flaggedElements: Map<selector, { href, eventType, confidence, patterns, targetUrls, timestamp }>,
 *   hiddenLinks: Array<{ href, hidingMethod, coordinates, timestamp }>,
 *   linkClassifications: Map<url, { riskScore, riskLevel }>,
 *   dynamicLinks: Array<{ url, injectedAt, timestamp }>,
 *   scamOverlays: Array<{ text, scamType, timestamp }>,
 *   stats: { hiddenCount, hijackedCount, dynamicCount, scamCount }
 * }>
 */
const tabState = new Map();

// ─── Tab State Management ──────────────────────────────────────────

function getTabState(tabId) {
  if (!tabState.has(tabId)) {
    tabState.set(tabId, {
      flaggedElements: new Map(),
      hiddenLinks: [],
      linkClassifications: new Map(),
      dynamicLinks: [],
      scamOverlays: [],
      stats: { hiddenCount: 0, hijackedCount: 0, dynamicCount: 0, scamCount: 0 },
    });
  }
  return tabState.get(tabId);
}

function cleanupTab(tabId) {
  tabState.delete(tabId);
}

// ─── Message Handlers ──────────────────────────────────────────────

function setupMessageHandlers() {
  // Event flag from event-inspector
  onMessage(MSG.EVENT_FLAG, (payload, sender) => {
    const tabId = sender.tab?.id;
    if (!tabId) return;

    const state = getTabState(tabId);
    state.flaggedElements.set(payload.elementSelector, {
      href: payload.href,
      eventType: payload.eventType,
      confidence: payload.confidence,
      patterns: payload.matchedPatterns,
      targetUrls: payload.targetUrls,
      timestamp: payload.timestamp,
    });

    // Update stats
    state.stats.hijackedCount = state.flaggedElements.size;
    storage.incrementStat('hijackedElementsFlagged').catch(() => { });

    // Update toolbar badge
    updateBadge(tabId);

    return { ok: true };
  });

  // Hidden links found
  onMessage(MSG.HIDDEN_LINKS_FOUND, (payload, sender) => {
    const tabId = sender.tab?.id;
    if (!tabId) return;

    const state = getTabState(tabId);
    state.hiddenLinks = payload.hiddenLinks || [];
    state.stats.hiddenCount = state.hiddenLinks.length;

    // Update badge
    updateBadge(tabId);

    return { ok: true };
  });

  // Dynamic links found
  onMessage(MSG.DYNAMIC_LINKS, (payload, sender) => {
    const tabId = sender.tab?.id;
    if (!tabId) return;

    const state = getTabState(tabId);
    state.dynamicLinks.push(...(payload.links || []));
    state.stats.dynamicCount = state.dynamicLinks.length;

    return { ok: true };
  });

  // Scam overlay detected
  onMessage(MSG.SCAM_OVERLAY, (payload, sender) => {
    const tabId = sender.tab?.id;
    if (!tabId) return;

    const state = getTabState(tabId);
    state.scamOverlays.push(payload);
    state.stats.scamCount = state.scamOverlays.length;
    storage.incrementStat('suspiciousDomainsDetected').catch(() => { });

    return { ok: true };
  });

  // Popup blocked
  onMessage(MSG.POPUP_BLOCKED, (payload, sender) => {
    storage.incrementStat('popupsPrevented').catch(() => { });
    return { ok: true };
  });

  // Popup asking for stats
  onMessage(MSG.GET_STATS, async () => {
    return await storage.getStats();
  });

  // Popup asking for protection status
  onMessage(MSG.GET_PROTECTION_STATUS, async (payload) => {
    const { tabId } = payload;
    const settings = await storage.getSettings();
    if (!tabId) return { enabled: settings.protectionEnabled };

    try {
      const tab = await browser.tabs.get(tabId);
      const url = tab?.url || '';
      const isWhitelisted = await storage.isWhitelisted(url);
      return {
        enabled: settings.protectionEnabled && !isWhitelisted,
        isWhitelisted,
        domain: url ? new URL(url).hostname : '',
      };
    } catch {
      return { enabled: settings.protectionEnabled, isWhitelisted: false, domain: '' };
    }
  });

  // Toggle protection for a tab
  onMessage(MSG.TOGGLE_PROTECTION, async (payload) => {
    const { tabId } = payload;
    try {
      const tab = await browser.tabs.get(tabId);
      const url = tab?.url || '';
      const domain = new URL(url).hostname;
      const isCurrentlyWhitelisted = await storage.isWhitelisted(url);
      if (isCurrentlyWhitelisted) {
        await storage.removeFromWhitelist(domain);
      } else {
        await storage.addToWhitelist(domain);
      }
      return { nowWhitelisted: !isCurrentlyWhitelisted, domain };
    } catch {
      return { error: 'Could not toggle protection' };
    }
  });

  // Popup asking for link scan results
  onMessage(MSG.GET_LINK_SCAN, async (payload) => {
    const tabId = payload.tabId;
    const state = getTabState(tabId);
    return {
      hiddenLinks: state.hiddenLinks,
      flaggedElements: [...state.flaggedElements.values()],
      scamOverlays: state.scamOverlays,
      stats: state.stats,
      hasHidden: state.stats.hiddenCount > 0,
      hasHijacked: state.stats.hijackedCount > 0,
      hasScam: state.stats.scamCount > 0,
    };
  });

  // Trigger a manual scan
  onMessage(MSG.TRIGGER_SCAN, async (payload) => {
    const { tabId } = payload;
    await sendToTab(tabId, MSG.TRIGGER_SCAN, {});
    return { ok: true };
  });

  // Reveal hidden links
  onMessage(MSG.REVEAL_HIDDEN_REQUEST, async (payload) => {
    const { tabId } = payload;
    await sendToTab(tabId, MSG.REVEAL_HIDDEN, {});
    return { ok: true };
  });
}

// ─── Badge Updates ─────────────────────────────────────────────────

/**
 * Update the toolbar badge with hidden/hijacked link count.
 */
async function updateBadge(tabId) {
  const state = getTabState(tabId);
  const totalFlags = state.stats.hiddenCount + state.stats.hijackedCount + state.stats.scamCount;

  if (totalFlags > 0) {
    // Text
    const text = totalFlags > 99 ? '99+' : String(totalFlags);
    await browser.action.setBadgeText({ tabId, text });
    // Color: red for hijacks, orange for only hidden/scam
    const hasDanger = state.stats.hijackedCount > 0 || state.stats.scamCount > 0;
    await browser.action.setBadgeBackgroundColor({ tabId, color: hasDanger ? '#d32f2f' : '#f57c00' });
  } else {
    await browser.action.setBadgeText({ tabId, text: '' });
  }
}

// ─── Teardown ──────────────────────────────────────────────────────

function setupTabLifecycle() {
  browser.tabs.onRemoved.addListener(cleanupTab);
  // On tab update, reset state for fresh navigation
  browser.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.url) {
      // Tab navigated to new page - clear old state after a brief delay
      // (content scripts will re-initialize and send fresh data)
      setTimeout(() => {
        tabState.delete(tabId);
        browser.action.setBadgeText({ tabId, text: '' });
      }, 1000);
    }
  });
}

// ─── Init ──────────────────────────────────────────────────────────

export function init() {
  setupMessageHandlers();
  setupTabLifecycle();
}
