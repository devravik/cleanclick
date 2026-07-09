/**
 * Mock for the `webextension-polyfill` `browser` API.
 * Used in Jest tests to simulate Firefox WebExtensions APIs.
 */
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
    _reset: () => { store = {}; },
  };
};

const createTab = (overrides = {}) => ({
  id: 1,
  url: 'https://example.com',
  active: true,
  ...overrides,
});

const browserMock = {
  tabs: {
    query: jest.fn(() => Promise.resolve([createTab()])),
    create: jest.fn(() => Promise.resolve(createTab())),
    update: jest.fn(() => Promise.resolve()),
    remove: jest.fn(() => Promise.resolve()),
    onCreated: { addListener: jest.fn(), removeListener: jest.fn() },
    onUpdated: { addListener: jest.fn(), removeListener: jest.fn() },
    onActivated: { addListener: jest.fn(), removeListener: jest.fn() },
    onRemoved: { addListener: jest.fn(), removeListener: jest.fn() },
  },
  webNavigation: {
    onCommitted: { addListener: jest.fn(), removeListener: jest.fn() },
    onCreatedNavigationTarget: { addListener: jest.fn(), removeListener: jest.fn() },
    onErrorOccurred: { addListener: jest.fn(), removeListener: jest.fn() },
    onDOMContentLoaded: { addListener: jest.fn(), removeListener: jest.fn() },
    onCompleted: { addListener: jest.fn(), removeListener: jest.fn() },
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
    onClicked: { addListener: jest.fn(), removeListener: jest.fn() },
  },
  contextualIdentities: {
    query: jest.fn(() => Promise.resolve([])),
    create: jest.fn(() => Promise.resolve({})),
  },
  i18n: {
    getMessage: jest.fn((key) => key),
    getUILanguage: jest.fn(() => 'en-US'),
  },
};

export default browserMock;
