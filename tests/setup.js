/**
 * Test setup file for Jest.
 * Configures webextension-polyfill mock and global test utilities.
 */
import browserMock from './__mocks__/browser-mock.js';

// Mock the webextension-polyfill module
jest.mock('webextension-polyfill', () => browserMock, { virtual: true });

// Make browser available globally (as it is in Firefox extensions)
global.browser = browserMock;

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
