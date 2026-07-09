/**
 * CleanClick — Cross-Browser Shim
 *
 * In Firefox MV3: `browser` is a global (WebExtensions API).
 * In Chrome/Edge MV3: `chrome` is the global; `browser` is undefined.
 *
 * This shim provides a global `browser` alias for Chrome/Edge.
 * It's the minimal wrapper needed — just aliases `chrome.*` to `browser.*`.
 */

if (typeof browser === 'undefined') {
  if (typeof chrome !== 'undefined') {
    // Chrome/Edge/Safari: alias chrome → browser
    globalThis.browser = chrome;
  } else if (typeof self?.chrome !== 'undefined') {
    // Some service worker contexts
    globalThis.browser = self.chrome;
  }
}
