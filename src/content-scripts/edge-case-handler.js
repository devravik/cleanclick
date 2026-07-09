/**
 * CleanClick — Edge Case Handler (Content Script)
 *
 * 🟡 NEW MODULE — Phase 2
 *
 * Handles advanced attack surfaces that don't fit other modules:
 * - Cross-origin frame escape (target="_top" from iframe)
 * - SVG <a> element injection
 * - Custom element link detection
 * - Unicode bidirectional override / zero-width chars
 * - Same-domain user-generated content
 * - iframe srcdoc scanning
 * - <object>/<embed> data URL checks
 * - clients.openWindow from service workers
 *
 * Runs at document_idle.
 */

import { sendMessage } from '../shared/messaging.js';
import { detectBidiOverrides, detectInvisibleChars, parseURL } from '../shared/utils.js';

// ─── A. Cross-Origin Frame Escape ────────────────────────────────

function checkFrameEscape() {
  try {
    if (window.self === window.top) return; // Not in iframe

    // We're in an iframe — check all links with target="_top" or "_parent"
    const links = document.querySelectorAll('a[target="_top"], a[target="_parent"], area[target="_top"], area[target="_parent"]');
    const issues = [];

    for (const link of links) {
      const href = link.href || '';
      if (!href) continue;
      try {
        const targetOrigin = new URL(href, window.location.href).origin;
        const topOrigin = window.top.location.origin;
        if (targetOrigin !== topOrigin) {
          issues.push({
            href,
            targetOrigin,
            topOrigin,
            type: 'cross-origin-frame-escape',
          });
        }
      } catch {
        // Cross-origin access to top.location is blocked — that's expected
      }
    }

    if (issues.length > 0) {
      sendMessage('edge:frame-escape', {
        issues,
        frameOrigin: window.location.origin,
        timestamp: Date.now(),
      }).catch(() => {});
    }
  } catch {
    // Cross-origin iframe — can't access top
  }
}

// ─── B. SVG <a> Element Scanning ─────────────────────────────────

function scanSVGLinks() {
  const svgLinks = document.querySelectorAll('svg a, svg *[xlink\\:href], svg *[href]');
  const issues = [];

  for (const el of svgLinks) {
    const href = el.getAttribute('href') || el.getAttributeNS('http://www.w3.org/1999/xlink', 'href') || '';
    if (!href) continue;

    // SVG links can navigate — flag if suspicious
    try {
      const u = new URL(href, window.location.href);
      if (u.origin !== window.location.origin) {
        issues.push({
          href: u.href,
          origin: u.origin,
          type: 'svg-cross-origin',
          tag: el.tagName,
        });
      }
    } catch {}
  }

  if (issues.length > 0) {
    sendMessage('edge:svg-links', {
      issues,
      count: issues.length,
      timestamp: Date.now(),
    }).catch(() => {});
  }
}

// ─── C. Custom Element Link Detection ─────────────────────────────

function checkCustomElements() {
  // Only works if customElements API is available
  if (typeof customElements === 'undefined') return;

  const issues = [];

  // Get all defined custom element names
  const defined = customElements.getName(HTMLUnknownElement);
  // Iterate all elements and check for custom ones with href-like behavior
  const allElements = document.querySelectorAll('*');
  const seen = new Set();

  for (const el of allElements) {
    const tag = el.tagName.toLowerCase();
    if (!tag.includes('-')) continue; // Only custom elements
    if (seen.has(tag)) continue;
    seen.add(tag);

    // Check if this custom element has a 'href' attribute or navigates
    if (el.hasAttribute('href') || el.hasAttribute('to') || el.hasAttribute('navigate')) {
      const href = el.getAttribute('href') || el.getAttribute('to') || el.getAttribute('navigate') || '';
      if (href) {
        issues.push({
          tagName: tag,
          href,
          type: 'custom-element-link',
        });
      }
    }
  }

  if (issues.length > 0) {
    sendMessage('edge:custom-elements', {
      issues,
      timestamp: Date.now(),
    }).catch(() => {});
  }
}

// ─── D. Unicode Bidi Override & Zero-Width Detection ─────────────

function checkUnicodeAnomalies() {
  const links = document.querySelectorAll('a[href]');
  const issues = [];

  for (const link of links) {
    const href = link.href || '';
    const text = link.textContent || '';

    // Check href for bidi overrides
    const bidi = detectBidiOverrides(href);
    if (bidi.found) {
      issues.push({
        href,
        type: 'bidi-override',
        positions: bidi.positions,
        text: text.slice(0, 100),
      });
    }

    // Check href for invisible characters
    const invisible = detectInvisibleChars(href);
    if (invisible.found) {
      issues.push({
        href,
        type: 'invisible-chars',
        chars: invisible.chars,
        text: text.slice(0, 100),
      });
    }

    // Check text for bidi
    if (text) {
      const textBidi = detectBidiOverrides(text);
      if (textBidi.found) {
        issues.push({
          href,
          type: 'bidi-in-text',
          positions: textBidi.positions,
          text: text.slice(0, 100),
        });
      }
    }
  }

  if (issues.length > 0) {
    sendMessage('edge:unicode-anomalies', {
      issues,
      count: issues.length,
      timestamp: Date.now(),
    }).catch(() => {});
  }
}

// ─── E. Same-Domain UGC Detection ────────────────────────────────

const UGC_PATH_PATTERNS = [
  /^\/user\//i, /^\/profile\//i, /^\/comment\//i,
  /^\/forum\//i, /^\/topic\//i, /^\/post\//i,
  /^\/community\//i, /^\/discussion\//i, /^\/thread\//i,
  /^\/r\//i, /^\/u\//i, // Reddit-style
  /^\/p\//i, /^\/t\//i, // Various forum styles
];

function detectUGC() {
  const links = document.querySelectorAll('a[href]');
  const issues = [];

  for (const link of links) {
    const href = link.href || '';
    try {
      const u = new URL(href);
      if (u.origin !== window.location.origin) continue; // Only same-domain

      const path = u.pathname;
      for (const pattern of UGC_PATH_PATTERNS) {
        if (pattern.test(path)) {
          issues.push({
            href,
            path: path.slice(0, 80),
            text: (link.textContent || '').trim().slice(0, 60),
            type: 'ugc-link',
          });
          break;
        }
      }
    } catch {}
  }

  if (issues.length > 0) {
    sendMessage('edge:ugc-links', {
      issues,
      count: issues.length,
      timestamp: Date.now(),
    }).catch(() => {});
  }
}

// ─── F. iframe srcdoc Scanning ───────────────────────────────────

function scanIframeSrcdoc() {
  const iframes = document.querySelectorAll('iframe[srcdoc]');
  const issues = [];

  for (const iframe of iframes) {
    const srcdoc = iframe.getAttribute('srcdoc') || '';
    if (!srcdoc) continue;

    // Parse links from srcdoc HTML
    const hrefRegex = /href\s*=\s*["'](https?:\/\/[^"']+)["']/gi;
    let match;
    while ((match = hrefRegex.exec(srcdoc)) !== null) {
      const url = match[1];
      try {
        const u = new URL(url);
        if (u.origin !== window.location.origin) {
          issues.push({
            url,
            origin: u.origin,
            type: 'iframe-srcdoc-external',
          });
        }
      } catch {}
    }
  }

  if (issues.length > 0) {
    sendMessage('edge:iframe-srcdoc', {
      issues,
      timestamp: Date.now(),
    }).catch(() => {});
  }
}

// ─── G. <object>/<embed> Data URL Checks ────────────────────────

function checkObjectEmbed() {
  const elements = document.querySelectorAll('object[data], embed[src]');
  const issues = [];

  for (const el of elements) {
    const url = el.getAttribute('data') || el.getAttribute('src') || '';
    if (!url) continue;

    try {
      const u = new URL(url, window.location.href);
      if (u.origin !== window.location.origin) {
        // Check if it's a media file (likely safe) or something else
        const path = u.pathname.toLowerCase();
        const mediaExts = ['.jpg','.jpeg','.png','.gif','.svg','.webp','.mp4','.mp3','.pdf','.swf'];
        if (!mediaExts.some(ext => path.endsWith(ext))) {
          issues.push({
            url: u.href,
            tag: el.tagName,
            type: 'external-nonmedia-embed',
          });
        }
      }
    } catch {}
  }

  if (issues.length > 0) {
    sendMessage('edge:object-embed', {
      issues,
      timestamp: Date.now(),
    }).catch(() => {});
  }
}

// ─── H. clients.openWindow Monitoring ────────────────────────────

function monitorServiceWorkerWindows() {
  // Listen for messages from service workers that might indicate
  // clients.openWindow calls
  navigator.serviceWorker?.addEventListener('message', (event) => {
    const data = event.data;
    if (typeof data === 'object' && data !== null) {
      if (data.type === 'openWindow' || (typeof data.url === 'string' && data.url.startsWith('http'))) {
        sendMessage('edge:sw-open-window', {
          url: data.url || data.target,
          origin: event.origin,
          timestamp: Date.now(),
        }).catch(() => {});
      }
    }
  });
}

// ─── Init ─────────────────────────────────────────────────────────

export function init() {
  checkFrameEscape();
  scanSVGLinks();
  checkCustomElements();
  checkUnicodeAnomalies();
  detectUGC();
  scanIframeSrcdoc();
  checkObjectEmbed();
  monitorServiceWorkerWindows();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
