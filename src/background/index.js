/**
 * CleanClick — Background Script Entry Point
 *
 * Initializes all background modules on extension startup.
 * Wires up message routing between content scripts ↔ background ↔ popup.
 */

import storage from '../shared/storage.js';
import { onMessages, onConnectFromContent } from '../shared/messaging.js';
import { MSG } from '../shared/constants.js';
import { init as initRedirectDetector } from './redirect-detector.js';
import { init as initEventCoordinator } from './event-coordinator.js';
import { init as initWhitelistManager } from './whitelist-manager.js';
import { init as initStatistics } from './statistics.js';

// ─── Extension Lifecycle ───────────────────────────────────────────

/**
 * Called once when the extension is installed or updated.
 */
async function onInstalled(details) {
  if (details.reason === 'install') {
    // First install — set up defaults
    await storage.init();

    // Open the welcome/options page
    browser.runtime.openOptionsPage();
  } else if (details.reason === 'update') {
    // Run migration
    await storage.init();
  }
}

/**
 * Initialize all background modules.
 */
async function initBackground() {
  // 1. Initialize storage (migrations, defaults)
  await storage.init();

  // 2. Initialize all modules
  initRedirectDetector();
  initEventCoordinator();
  initWhitelistManager();
  initStatistics();

  // 3. Set up context menu items (right-click link inspector)
  setupContextMenus();

  // 4. Handle incoming connections from content scripts
  onConnectFromContent((port, sender) => {
    // Content script connected — tab info is available
    // We don't need per-connection state; messages handle routing
  });

  console.log('CleanClick: Background initialized');
}

// ─── Context Menu ──────────────────────────────────────────────────

function setupContextMenus() {
  // Remove existing menus first (in case of update)
  browser.menus.removeAll();

  // Check link safety
  browser.menus.create({
    id: 'check-link-safety',
    title: browser.i18n.getMessage('linkSafetyCheck'),
    contexts: ['link'],
  });

  // Copy clean URL
  browser.menus.create({
    id: 'copy-clean-url',
    title: browser.i18n.getMessage('copyCleanUrl'),
    contexts: ['link'],
  });

  // Open in container tab (Firefox Container)
  browser.menus.create({
    id: 'open-in-container',
    title: 'Open in Container Tab',
    contexts: ['link'],
  });

  // Report link
  browser.menus.create({
    id: 'report-link',
    title: browser.i18n.getMessage('reportLink'),
    contexts: ['link'],
  });

  // Handle menu clicks
  browser.menus.onClicked.addListener(async (info, tab) => {
    const linkUrl = info.linkUrl;

    switch (info.menuItemId) {
      case 'check-link-safety': {
        const { classifyURL } = await import('../shared/link-classifier.js');
        const result = classifyURL(linkUrl);
        // Show result in notification
        browser.notifications.create({
          type: 'basic',
          iconUrl: browser.runtime.getURL('assets/icons/icon-48.png'),
          title: `Link Safety: ${result.riskLevel}`,
          message: `Risk score: ${result.riskScore}/100\n${result.reasons.join('\n') || 'No issues detected'}`,
        });
        break;
      }
      case 'copy-clean-url': {
        const { stripTrackingParams } = await import('../shared/utils.js');
        const { TRACKING_PARAMS } = await import('../shared/constants.js');
        const cleanUrl = stripTrackingParams(linkUrl, TRACKING_PARAMS);
        // Copy to clipboard via content script
        if (tab?.id) {
          browser.tabs.sendMessage(tab.id, {
            type: 'copy-to-clipboard',
            payload: { text: cleanUrl },
          }).catch(() => {});
        }
        break;
      }
      case 'open-in-container': {
        // Open in a new container tab (requires contextualIdentities permission)
        try {
          const containers = await browser.contextualIdentities.query({});
          // Use the first container or create a temporary isolated one
          const container = containers[0] || await browser.contextualIdentities.create({
            name: 'CleanClick Isolated',
            color: 'blue',
            icon: 'fingerprint',
          });
          await browser.tabs.create({
            url: linkUrl,
            cookieStoreId: container.cookieStoreId,
          });
        } catch (err) {
          console.warn('Container not available:', err);
          // Fallback: open in regular tab
          browser.tabs.create({ url: linkUrl });
        }
        break;
      }
      case 'report-link': {
        // Placeholder for community reporting (v2.0)
        browser.notifications.create({
          type: 'basic',
          iconUrl: browser.runtime.getURL('assets/icons/icon-48.png'),
          title: 'CleanClick',
          message: 'Community reporting coming soon!',
        });
        break;
      }
    }
  });
}

// ─── Startup ───────────────────────────────────────────────────────

browser.runtime.onInstalled.addListener(onInstalled);

// Initialize on background script load
initBackground().catch(err => {
  console.error('CleanClick: Background init failed:', err);
});
