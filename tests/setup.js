/**
 * Test setup file for Jest.
 * Configures webextension-polyfill mock and global test utilities.
 */

// Mock the webextension-polyfill module
jest.mock('webextension-polyfill', () => {
  const createStorageArea = () => {
    let store = {};
    return {
      get: jest.fn((keys) => {
        if (typeof keys === 'string') return Promise.resolve({ [keys]: store[keys] });
        if (Array.isArray(keys)) {
          const result = {};
          keys.forEach(k => { if (k in store) result[k] = store[k]; });
          return Promise.resolve(result);
        }
        return Promise.resolve({ ...store });
      }),
      set: jest.fn((items) => {
        Object.assign(store, items);
        return Promise.resolve();
      }),
      remove: jest.fn((keys) => {
        if (typeof keys === 'string') keys = [keys];
        keys.forEach(k => delete store[k]);
        return Promise.resolve();
      }),
      clear: jest.fn(() => { store = {}; return Promise.resolve(); }),
    };
  };

  return {
    tabs: {
      query: jest.fn(() => Promise.resolve([{ id: 1, url: 'https://example.com', active: true }])),
      create: jest.fn(() => Promise.resolve({ id: 2 })),
      update: jest.fn(() => Promise.resolve()),
      remove: jest.fn(() => Promise.resolve()),
      get: jest.fn((id) => Promise.resolve({ id, url: 'https://example.com', openerTabId: 0 })),
      onCreated: { addListener: jest.fn(), removeListener: jest.fn() },
      onUpdated: { addListener: jest.fn(), removeListener: jest.fn() },
      onActivated: { addListener: jest.fn(), removeListener: jest.fn() },
      onRemoved: { addListener: jest.fn(), removeListener: jest.fn() },
    },
    webNavigation: {
      onCommitted: { addListener: jest.fn(), removeListener: jest.fn() },
      onCreatedNavigationTarget: { addListener: jest.fn(), removeListener: jest.fn() },
      onErrorOccurred: { addListener: jest.fn(), removeListener: jest.fn() },
    },
    storage: {
      local: createStorageArea(),
      sync: createStorageArea(),
      onChanged: { addListener: jest.fn(), removeListener: jest.fn() },
    },
    runtime: {
      sendMessage: jest.fn(() => Promise.resolve()),
      onMessage: { addListener: jest.fn(), removeListener: jest.fn() },
      openOptionsPage: jest.fn(() => Promise.resolve()),
      getURL: jest.fn((path) => `mock-extension://${path}`),
      id: 'mock-extension-id',
      onInstalled: { addListener: jest.fn(), removeListener: jest.fn() },
      onConnect: { addListener: jest.fn(), removeListener: jest.fn() },
    },
    scripting: {
      executeScript: jest.fn(() => Promise.resolve([])),
      insertCSS: jest.fn(() => Promise.resolve()),
    },
    declarativeNetRequest: {
      updateDynamicRules: jest.fn(() => Promise.resolve()),
      getDynamicRules: jest.fn(() => Promise.resolve([])),
    },
    notifications: {
      create: jest.fn(() => Promise.resolve('notification-id')),
      clear: jest.fn(() => Promise.resolve(true)),
      onClicked: { addListener: jest.fn(), removeListener: jest.fn() },
    },
    menus: {
      create: jest.fn(() => 'menu-item-id'),
      update: jest.fn(() => Promise.resolve()),
      remove: jest.fn(() => Promise.resolve()),
      removeAll: jest.fn(() => Promise.resolve()),
      onClicked: { addListener: jest.fn(), removeListener: jest.fn() },
    },
    contextualIdentities: {
      query: jest.fn(() => Promise.resolve([])),
      create: jest.fn(() => Promise.resolve({ cookieStoreId: 'firefox-container-1' })),
    },
    i18n: {
      getMessage: jest.fn((key) => key),
      getUILanguage: jest.fn(() => 'en-US'),
    },
    action: {
      setBadgeText: jest.fn(() => Promise.resolve()),
      setBadgeBackgroundColor: jest.fn(() => Promise.resolve()),
    },
  };
}, { virtual: true });

// Make browser available globally (as it is in Firefox extensions)
const browser = require('webextension-polyfill');
global.browser = browser;

// Mock window.matchMedia for popup/options tests
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock requestIdleCallback
global.requestIdleCallback = jest.fn((cb, opts) => setTimeout(cb, opts?.timeout || 0));
global.cancelIdleCallback = jest.fn((id) => clearTimeout(id));
