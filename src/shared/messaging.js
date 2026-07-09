/**
 * CleanClick — Typed Message Passing
 *
 * Provides a type-safe messaging layer between:
 *   Content Scripts  ↔  Background Script  ↔  Popup/Options
 *
 * Uses browser.runtime.sendMessage for one-shot messages.
 * Uses browser.runtime.connect (port) for long-lived content ↔ background channels.
 */

import { MSG } from './constants.js';

// ─── Message Sender ────────────────────────────────────────────────

/**
 * Send a message to the background script.
 * @param {string} type - Message type constant from MSG
 * @param {*} [payload] - Optional payload
 * @param {number} [timeout=5000] - Timeout in ms
 * @returns {Promise<*>} Response from background
 */
export async function sendMessage(type, payload, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Message ${type} timed out after ${timeout}ms`));
    }, timeout);

    browser.runtime.sendMessage({ type, payload }).then(response => {
      clearTimeout(timer);
      resolve(response);
    }).catch(err => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

/**
 * Send a message to a specific tab's content script.
 * @param {number} tabId
 * @param {string} type
 * @param {*} [payload]
 */
export async function sendToTab(tabId, type, payload) {
  try {
    await browser.tabs.sendMessage(tabId, { type, payload });
  } catch (err) {
    // Tab may have closed or content script not yet injected
    if (!err.message?.includes('Could not establish connection')) {
      console.warn(`sendToTab(${tabId}, ${type}):`, err);
    }
  }
}

// ─── Message Handler ───────────────────────────────────────────────

/**
 * Register a handler for a specific message type.
 * @param {string} type
 * @param {(payload: *, sender: browser.runtime.MessageSender) => Promise<*>} handler
 */
export function onMessage(type, handler) {
  browser.runtime.onMessage.addListener((message, sender) => {
    if (message.type === type) {
      return Promise.resolve(handler(message.payload, sender)).catch(err => {
        console.error(`Handler error for ${type}:`, err);
        return { error: err.message };
      });
    }
    return undefined; // Not handled — passes to next listener
  });
}

/**
 * Register a handler that handles multiple message types.
 * @param {Record<string, Function>} handlers - Map of type → handler
 */
export function onMessages(handlers) {
  browser.runtime.onMessage.addListener((message, sender) => {
    const handler = handlers[message.type];
    if (handler) {
      return Promise.resolve(handler(message.payload, sender)).catch(err => {
        console.error(`Handler error for ${message.type}:`, err);
        return { error: err.message };
      });
    }
    return undefined;
  });
}

// ─── Port-based Connection (Content ↔ Background) ──────────────────

/**
 * Connect to background script from a content script.
 * Returns a Port wrapper with typed send/onMessage.
 */
export function connectToBackground(name = 'content-script') {
  const port = browser.runtime.connect({ name });
  return createPortWrapper(port);
}

/**
 * Listen for incoming connections from content scripts.
 * @param {(port: PortWrapper, sender: browser.runtime.MessageSender) => void} onConnect
 */
export function onConnectFromContent(onConnect) {
  browser.runtime.onConnect.addListener((port) => {
    const wrapper = createPortWrapper(port);
    onConnect(wrapper, port.sender);
  });
}

/**
 * Create a port wrapper with typed send/onMessage.
 * @param {browser.runtime.Port} port
 * @returns {PortWrapper}
 */
function createPortWrapper(port) {
  const listeners = new Map();

  port.onMessage.addListener((message) => {
    const handler = listeners.get(message.type);
    if (handler) handler(message.payload);
  });

  port.onDisconnect.addListener(() => {
    listeners.clear();
  });

  return {
    /** Send a typed message through the port */
    send(type, payload) {
      try {
        port.postMessage({ type, payload });
      } catch (err) {
        console.warn('Port send failed:', err);
      }
    },

    /** Listen for a specific message type on this port */
    on(type, handler) {
      listeners.set(type, handler);
    },

    /** Remove a listener */
    off(type) {
      listeners.delete(type);
    },

    /** Disconnect the port */
    disconnect() {
      port.disconnect();
      listeners.clear();
    },

    /** The underlying port (for advanced use) */
    get raw() { return port; },
  };
}

// ─── Popup ↔ Background Shortcuts ─────────────────────────────────

export async function getStats() {
  return sendMessage(MSG.GET_STATS);
}

export async function getProtectionStatus(tabId) {
  return sendMessage(MSG.GET_PROTECTION_STATUS, { tabId });
}

export async function toggleProtection(tabId) {
  return sendMessage(MSG.TOGGLE_PROTECTION, { tabId });
}

export async function getLinkScan(tabId) {
  return sendMessage(MSG.GET_LINK_SCAN, { tabId });
}

export async function requestRevealHidden(tabId) {
  return sendMessage(MSG.REVEAL_HIDDEN_REQUEST, { tabId });
}
