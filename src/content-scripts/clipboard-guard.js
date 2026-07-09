/**
 * CleanClick - Clipboard Hijacking Protection (Content Script)
 *
 * 🟡 MODULE - Phase 3 (standalone)
 *
 * Detects unauthorized clipboard writes by scripts:
 * - Intercept copy/cut events
 * - Monitor clipboard.write() and clipboard.writeText() calls
 * - Detect silent modification of clipboard content
 * - Warn user when crypto addresses or URLs are tampered with
 *
 * Runs at document_idle with world: "MAIN".
 */

import { MSG } from '../shared/constants.js';
import { sendMessage } from '../shared/messaging.js';
import { detectInvisibleChars } from '../shared/utils.js';

// ─── State ─────────────────────────────────────────────────────────

const state = {
  /** Timer for debouncing clipboard checks */
  checkTimer: null,
  /** Last known clipboard content (for comparison) */
  lastClipboardContent: null,
  /** Whether we've warned for this page session */
  hasWarned: false,
};

// ─── Known Hazardous Patterns ─────────────────────────────────────

const CRYPTO_ADDRESS_PATTERNS = [
  /^[13][a-km-zA-HJ-NP-Z0-9]{26,33}$/,  // Bitcoin
  /^0x[a-fA-F0-9]{40}$/,                  // Ethereum
  /^(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,39}$/, // Bitcoin (bech32)
  /^T[a-zA-Z0-9]{33}$/,                   // Tron
  /^[a-z0-9]{40}$/,                       // BSC/Polygon style
];

const SUSPICIOUS_URL_PATTERNS = [
  /https?:\/\/bit\.ly\//,
  /https?:\/\/tinyurl\.com\//,
  /https?:\/\/shorturl\.at\//,
];

// ─── Monkey-patch clipboard.writeText ─────────────────────────────

function patchClipboardWrite() {
  if (typeof navigator.clipboard === 'undefined') return;

  const originalWriteText = navigator.clipboard.writeText.bind(navigator.clipboard);
  navigator.clipboard.writeText = async function patchedWriteText(text) {
    await analyzeWrittenContent(text, 'clipboard.writeText()');
    return originalWriteText(text);
  };

  if (navigator.clipboard.write) {
    const originalWrite = navigator.clipboard.write.bind(navigator.clipboard);
    navigator.clipboard.write = async function patchedWrite(items) {
      for (const item of items) {
        for (const type of item.types) {
          const blob = await item.getType(type);
          const text = await blob.text();
          if (text) {
            await analyzeWrittenContent(text, 'clipboard.write() [' + type + ']');
          }
        }
      }
      return originalWrite(items);
    };
  }

  // Monitor execCommand('copy') as a fallback
  document.addEventListener('copy', (e) => {
    // The clipboard content after a copy is the selected text
    // We check if a malicious script modifies it after the fact
    setTimeout(() => {
      checkClipboardAfterCopy();
    }, 100);
  }, true);
}

// ─── Analysis ─────────────────────────────────────────────────────

async function analyzeWrittenContent(text, source) {
  if (!text || typeof text !== 'string') return;

  const reasons = [];

  // Check for crypto address patterns
  for (const pattern of CRYPTO_ADDRESS_PATTERNS) {
    if (pattern.test(text.trim())) {
      reasons.push({
        type: 'crypto-address',
        detail: 'Cryptocurrency address detected in clipboard write',
        severity: 'high',
      });
      break;
    }
  }

  // Check for suspicious URLs
  for (const pattern of SUSPICIOUS_URL_PATTERNS) {
    if (pattern.test(text)) {
      reasons.push({
        type: 'suspicious-url',
        detail: 'Suspicious shortened URL placed in clipboard',
        severity: 'high',
      });
      break;
    }
  }

  // Check for invisible characters (silent data injection)
  const invisible = detectInvisibleChars(text);
  if (invisible.found) {
    reasons.push({
      type: 'invisible-chars',
      detail: 'Invisible unicode characters in clipboard content',
      severity: 'medium',
    });
  }

  if (reasons.length > 0 && !state.hasWarned) {
    state.hasWarned = true;
    showClipboardWarning(reasons, text);
  }

  if (reasons.length > 0) {
    sendMessage('clipboard:suspicious-write', {
      source,
      reasons,
      textPreview: text.slice(0, 200),
      timestamp: Date.now(),
    }).catch(() => { });
  }
}

/**
 * Check clipboard content after a copy event to detect silent modification.
 */
async function checkClipboardAfterCopy() {
  try {
    const text = await navigator.clipboard.readText();
    if (!text) return;

    // Compare with what we expect (the selected text)
    const selection = window.getSelection()?.toString() || '';
    if (selection && text !== selection) {
      // Clipboard was modified!
      const reasons = [{
        type: 'clipboard-modified',
        detail: 'Clipboard content differs from selection - possible hijack',
        severity: 'critical',
      }];

      showClipboardWarning(reasons, text);
      sendMessage('clipboard:modified', {
        selectionPreview: selection.slice(0, 200),
        clipboardPreview: text.slice(0, 200),
        timestamp: Date.now(),
      }).catch(() => { });
    }
  } catch {
    // Clipboard access may be blocked - that's normal
  }
}

// ─── User Warning UI ──────────────────────────────────────────────

function showClipboardWarning(reasons, text) {
  const existing = document.getElementById('cleanclick-clipboard-warning');
  if (existing) existing.remove();

  const banner = document.createElement('div');
  banner.id = 'cleanclick-clipboard-warning';
  banner.style.cssText = 'position:fixed;bottom:0;left:0;right:0;z-index:2147483647;' +
    'background:#ffebee;color:#b71c1c;padding:12px 16px;' +
    'font-family:-apple-system,system-ui,sans-serif;font-size:13px;' +
    'box-shadow:0 -2px 8px rgba(0,0,0,0.15);display:flex;align-items:center;gap:12px;';

  const reasonsHtml = reasons.map(r =>
    '<div style="font-size:12px;margin-top:2px">\u26A0\uFE0F ' + escapeHtml(r.detail) + '</div>'
  ).join('');

  banner.innerHTML =
    '<span style="font-size:24px">\uD83D\uDCCB</span>' +
    '<div style="flex:1">' +
    '<strong>Clipboard Warning</strong>' +
    reasonsHtml +
    '<div style="font-size:11px;color:#888;margin-top:4px;word-break:break-all">Content: ' + escapeHtml(text.slice(0, 100)) + '</div>' +
    '</div>' +
    '<button onclick="this.parentElement.remove()" style="padding:6px 12px;background:#b71c1c;color:white;border:none;border-radius:4px;cursor:pointer">OK</button>';

  document.body.appendChild(banner);

  // Auto-dismiss after 15 seconds
  setTimeout(() => {
    const el = document.getElementById('cleanclick-clipboard-warning');
    if (el) el.remove();
  }, 15000);
}

// ─── ExecCommand Monitoring ───────────────────────────────────────

// Some sites use document.execCommand('copy') - we patch it too
function patchExecCommand() {
  const originalExec = document.execCommand.bind(document);
  document.execCommand = function patchedExecCommand(command, showUI, value) {
    if (command.toLowerCase() === 'copy') {
      setTimeout(() => checkClipboardAfterCopy(), 100);
    }
    return originalExec(command, showUI, value);
  };
}

// ─── Utility ──────────────────────────────────────────────────────

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ─── Init ─────────────────────────────────────────────────────────

export function init() {
  patchClipboardWrite();
  patchExecCommand();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
