/**
 * CleanClick — Expanded Navigation Guard (Content Script)
 *
 * ⬆️ EXPANDED from original plan
 *
 * Covers all non-<a> navigation vectors:
 * - Form submission hijacking
 * - Meta refresh redirects
 * - Service worker registration monitoring
 * - History API abuse detection
 * - PostMessage origin validation
 *
 * Runs at document_start with world: "MAIN".
 */

import { MSG } from '../shared/constants.js';
import { sendMessage, sendToTab } from '../shared/messaging.js';

// ─── Form Submission Hijacking Detection ──────────────────────────

/**
 * Intercept form submissions and check if the action points
 * to an unexpected domain.
 */
class FormGuard {
  constructor() {
    this._originalSubmit = HTMLFormElement.prototype.submit;
    this._patchFormSubmit();
    this._listenForSubmitEvents();
  }

  _patchFormSubmit() {
    const guard = this;
    HTMLFormElement.prototype.submit = function patchedSubmit() {
      if (guard._checkFormAction(this)) {
        return; // Blocked
      }
      return guard._originalSubmit.call(this);
    };
  }

  _listenForSubmitEvents() {
    document.addEventListener('submit', (e) => {
      const form = e.target;
      if (form && form.tagName === 'FORM') {
        if (this._checkFormAction(form)) {
          e.preventDefault();
        }
      }
    }, true); // capture phase
  }

  /**
   * Check if a form's action points to an untrusted domain.
   * Returns true if the submission should be blocked.
   */
  _checkFormAction(form) {
    const action = form.action || '';
    if (!action || action === 'about:blank') return false;

    const currentOrigin = window.location.origin;
    try {
      const actionURL = new URL(action, window.location.href);
      if (actionURL.origin === currentOrigin) return false;

      // Different origin — warn user
      const reason = `Form submits to ${actionURL.origin} (different from ${currentOrigin})`;
      this._showWarning(reason, actionURL.href, form);

      // Log to background
      sendMessage('navigation:form-hijack', {
        action: actionURL.href,
        origin: currentOrigin,
        formId: form.id || form.name || '(unnamed)',
        timestamp: Date.now(),
      }).catch(() => {});

      return true; // Block
    } catch {
      return false;
    }
  }

  _showWarning(reason, destination, form) {
    const banner = document.createElement('div');
    banner.id = 'cleanclick-form-warning';
    banner.style.cssText = `
      position: fixed; top: 0; left: 0; right: 0; z-index: 2147483647;
      background: #fff3cd; color: #856404; padding: 12px 20px;
      font-family: -apple-system, system-ui, sans-serif; font-size: 14px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
      display: flex; align-items: center; gap: 12px;
    `;
    banner.innerHTML = `
      <span style="font-size:20px">!</span>
      <span><strong>CleanClick:</strong> ${reason}</span>
      <button style="margin-left:auto;padding:6px 16px;background:#856404;color:white;border:none;
                     border-radius:4px;cursor:pointer"
              onclick="document.getElementById('cleanclick-form-warning').remove()">Dismiss</button>
    `;
    document.body.prepend(banner);
    setTimeout(() => { const b = document.getElementById('cleanclick-form-warning'); if (b) b.remove(); }, 10000);
  }
}

// ─── Meta Refresh Detection ───────────────────────────────────────

class MetaRefreshDetector {
  constructor() {
    this._scanMetaTags();
    this._observeNewMeta();
  }

  _scanMetaTags() {
    const metas = document.querySelectorAll('meta[http-equiv="refresh"]');
    for (const meta of metas) {
      this._analyzeMetaTag(meta);
    }
  }

  _observeNewMeta() {
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.tagName === 'META' && node.httpEquip?.toLowerCase() === 'refresh') {
            this._analyzeMetaTag(node);
          }
          if (node.querySelectorAll) {
            const nested = node.querySelectorAll('meta[http-equiv="refresh"]');
            nested.forEach(m => this._analyzeMetaTag(m));
          }
        }
      }
    });
    observer.observe(document.head || document.documentElement, {
      childList: true, subtree: true,
    });
  }

  _analyzeMetaTag(meta) {
    const content = meta.getAttribute('content') || '';
    const urlMatch = content.match(/url\s*=\s*(.+)/i);
    if (!urlMatch) return;

    let targetURL = urlMatch[1].trim();
    // Remove quotes if present
    targetURL = targetURL.replace(/^['"]|['"]$/g, '');

    // Resolve relative URLs
    try {
      targetURL = new URL(targetURL, window.location.href).href;
    } catch {
      return;
    }

    const currentOrigin = window.location.origin;
    try {
      const targetOrigin = new URL(targetURL).origin;
      if (targetOrigin !== currentOrigin) {
        // Cross-origin meta refresh — intercept
        this._interceptRefresh(targetURL, meta);
      }
    } catch {
      // ignore
    }
  }

  _interceptRefresh(targetURL, meta) {
    // Disable the meta refresh by modifying its content
    meta.setAttribute('content', '999999;url=about:blank');

    // Show overlay
    const overlay = document.createElement('div');
    overlay.id = 'cleanclick-refresh-warning';
    overlay.style.cssText = `
      position: fixed; top: 0; left: 0; right: 0; z-index: 2147483647;
      background: #fff; color: #15141a; padding: 20px; text-align: center;
      font-family: -apple-system, system-ui, sans-serif; font-size: 14px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      border-bottom: 2px solid #f57c00;
    `;
    overlay.innerHTML = `
      <p style="margin:0 0 8px"><strong>This page wants to redirect you</strong></p>
      <p style="margin:0 0 12px;color:#5b5b66;word-break:break-all">Destination: <code>${targetURL}</code></p>
      <div style="display:flex;gap:8px;justify-content:center">
        <button id="cleanclick-block-redirect" style="padding:8px 20px;background:#0060df;color:white;border:none;border-radius:4px;cursor:pointer">
          Stay on this page
        </button>
        <button id="cleanclick-allow-redirect" style="padding:8px 20px;background:#f5f5f7;color:#15141a;border:1px solid #cfcfd8;border-radius:4px;cursor:pointer">
          Allow redirect
        </button>
      </div>
    `;
    document.body.prepend(overlay);

    document.getElementById('cleanclick-block-redirect').onclick = () => overlay.remove();
    document.getElementById('cleanclick-allow-redirect').onclick = () => {
      overlay.remove();
      window.location.href = targetURL;
    };

    sendMessage('navigation:meta-refresh', {
      targetURL,
      origin: window.location.origin,
      timestamp: Date.now(),
    }).catch(() => {});
  }
}

// ─── Service Worker Registration Monitor ──────────────────────────

class ServiceWorkerGuard {
  constructor() {
    this._patchRegister();
  }

  _patchRegister() {
    if (typeof navigator.serviceWorker === 'undefined') return;

    const originalRegister = navigator.serviceWorker.register.bind(navigator.serviceWorker);
    const guard = this;

    navigator.serviceWorker.register = async function patchedRegister(scriptURL, options) {
      const currentOrigin = window.location.origin;
      try {
        const swOrigin = new URL(scriptURL, window.location.href).origin;
        if (swOrigin !== currentOrigin) {
          guard._notifyCrossOriginSW(scriptURL, swOrigin, currentOrigin);
          // Still allow, but warn
        }
      } catch {
        // invalid URL — let it through
      }

      sendMessage('navigation:sw-register', {
        scriptURL: typeof scriptURL === 'string' ? scriptURL : scriptURL.toString(),
        options,
        timestamp: Date.now(),
      }).catch(() => {});

      return originalRegister(scriptURL, options);
    };
  }

  _notifyCrossOriginSW(scriptURL, swOrigin, pageOrigin) {
    const banner = document.createElement('div');
    banner.id = 'cleanclick-sw-warning';
    banner.style.cssText = `
      position: fixed; top: 0; left: 0; right: 0; z-index: 2147483647;
      background: #ffebee; color: #b71c1c; padding: 12px 20px;
      font-family: -apple-system, system-ui, sans-serif; font-size: 14px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    `;
    banner.innerHTML = `
      <span><strong>CleanClick:</strong> Cross-origin service worker registered from ${swOrigin}</span>
      <button style="margin-left:12px;padding:4px 12px;background:#b71c1c;color:white;border:none;border-radius:4px;cursor:pointer"
              onclick="this.parentElement.remove()">OK</button>
    `;
    document.body.prepend(banner);
    setTimeout(() => { const b = document.getElementById('cleanclick-sw-warning'); if (b) b.remove(); }, 8000);
  }
}

// ─── History API Abuse Detection ──────────────────────────────────

class HistoryGuard {
  constructor() {
    this._patchHistoryMethods();
  }

  _patchHistoryMethods() {
    if (typeof history === 'undefined') return;

    const originalPushState = history.pushState.bind(history);
    const originalReplaceState = history.replaceState.bind(history);

    history.pushState = function patchedPushState(state, title, url) {
      if (url) {
        try {
          const newOrigin = new URL(url, window.location.href).origin;
          if (newOrigin !== window.location.origin) {
            sendMessage('navigation:history-api', {
              method: 'pushState',
              url,
              newOrigin,
              timestamp: Date.now(),
            }).catch(() => {});
          }
        } catch {
          // ignore
        }
      }
      return originalPushState(state, title, url);
    };

    history.replaceState = function patchedReplaceState(state, title, url) {
      if (url) {
        try {
          const newOrigin = new URL(url, window.location.href).origin;
          if (newOrigin !== window.location.origin) {
            sendMessage('navigation:history-api', {
              method: 'replaceState',
              url,
              newOrigin,
              timestamp: Date.now(),
            }).catch(() => {});
          }
        } catch {
          // ignore
        }
      }
      return originalReplaceState(state, title, url);
    };
  }
}

// ─── PostMessage Origin Validation ────────────────────────────────

class PostMessageGuard {
  constructor() {
    this._originalPostMessage = window.postMessage.bind(window);
    this._patchPostMessage();
    this._monitorMessageListeners();
  }

  _patchPostMessage() {
    const guard = this;
    window.postMessage = function patchedPostMessage(message, targetOrigin, transfer) {
      // Log all outgoing postMessages
      guard._logOutgoing(message, targetOrigin);
      return guard._originalPostMessage(message, targetOrigin, transfer);
    };
  }

  _monitorMessageListeners() {
    const originalAddEventListener = window.addEventListener.bind(window);
    const guard = this;

    window.addEventListener = function patchedAddEventListener(type, listener, options) {
      if (type === 'message') {
        // Wrap the listener to check if it triggers navigation
        const wrappedListener = function(event) {
          const origin = event.origin;
          guard._checkOriginNavigation(event, origin);
          return listener.apply(this, arguments);
        };
        return originalAddEventListener(type, wrappedListener, options);
      }
      return originalAddEventListener(type, listener, options);
    };
  }

  _checkOriginNavigation(event, origin) {
    // Check if event.data triggers a location change
    // This is best-effort — we can't intercept synchronous location changes
    // but we can log and warn
    if (typeof event.data === 'string' && event.data.includes('location')) {
      sendMessage('navigation:postmessage', {
        origin,
        dataPreview: event.data.slice(0, 200),
        timestamp: Date.now(),
      }).catch(() => {});
    }
  }

  _logOutgoing(message, targetOrigin) {
    // Log cross-origin postMessages
    if (targetOrigin && targetOrigin !== '*' && targetOrigin !== window.location.origin) {
      sendMessage('navigation:postmessage-outgoing', {
        targetOrigin,
        timestamp: Date.now(),
      }).catch(() => {});
    }
  }
}

// ─── Init ─────────────────────────────────────────────────────────

export function init() {
  new FormGuard();
  new MetaRefreshDetector();
  new ServiceWorkerGuard();
  new HistoryGuard();
  new PostMessageGuard();
}

// Auto-init
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
