/**
 * CleanClick - URL Shortener Bypass (Content Script)
 *
 * 🟡 MODULE - Phase 3 (standalone)
 *
 * Detects and expands shortened URLs to reveal their true destination
 * before the user clicks. Integrates with link-sanitizer for
 * the click-time interception; this module handles proactive display.
 */

import { SHORTENER_DOMAINS, MSG } from '../shared/constants.js';
import { sendMessage } from '../shared/messaging.js';

const expansionCache = new Map();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

/**
 * Detect if a URL uses a known shortener.
 */
function isShortened(url) {
  try {
    const u = new URL(url);
    return SHORTENER_DOMAINS.has(u.hostname) || SHORTENER_DOMAINS.has(u.hostname.replace(/^www\./, ''));
  } catch {
    return false;
  }
}

/**
 * Expand a shortened URL via HEAD request.
 * Returns null on failure.
 */
async function expandURL(url) {
  // Check cache
  const cached = expansionCache.get(url);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.finalUrl;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(url, {
      method: 'HEAD',
      redirect: 'follow',
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const finalUrl = response.url || url;
    expansionCache.set(url, { finalUrl, timestamp: Date.now() });
    return finalUrl;
  } catch {
    expansionCache.set(url, { finalUrl: url, timestamp: Date.now() });
    return null;
  }
}

/**
 * Scan all links and pre-expand shortened ones.
 * Shows the final destination in a tooltip-style annotation.
 */
async function scanAndAnnotate() {
  const links = document.querySelectorAll('a[href]');
  const shortLinks = [];

  for (const link of links) {
    const href = link.href || '';
    if (!href || href.startsWith('javascript:')) continue;
    if (isShortened(href)) {
      shortLinks.push(link);
    }
  }

  if (shortLinks.length === 0) return;

  // Batch expand - limit concurrent requests
  const concurrency = 3;
  for (let i = 0; i < shortLinks.length; i += concurrency) {
    const batch = shortLinks.slice(i, i + concurrency);
    await Promise.all(batch.map(async (link) => {
      const finalUrl = await expandURL(link.href);
      if (finalUrl && finalUrl !== link.href) {
        annotateShortLink(link, finalUrl);
      }
    }));
  }
}

/**
 * Add a visual annotation to a shortened link showing its final destination.
 */
function annotateShortLink(link, finalUrl) {
  // Add title attribute
  const existing = link.getAttribute('title') || '';
  const annotation = 'Expands to: ' + finalUrl;
  link.setAttribute('title', (existing ? existing + ' | ' : '') + annotation);

  // Add a small visual badge
  if (link.querySelector('.cleanclick-short-badge')) return;

  const badge = document.createElement('span');
  badge.className = 'cleanclick-short-badge';
  badge.style.cssText = 'display:inline-block;font-size:9px;font-family:-apple-system,system-ui,sans-serif;' +
    'padding:1px 5px;border-radius:3px;background:#e3f2fd;color:#1565c0;margin-left:4px;cursor:default;' +
    'font-weight:500;vertical-align:middle;';
  badge.textContent = '\u2197';
  badge.title = 'This URL is shortened. Final destination: ' + finalUrl;

  if (link.parentNode) {
    link.parentNode.insertBefore(badge, link.nextSibling);
  }
}

/**
 * Right-click context: expand a specific shortened URL.
 * Called from background context menu handler.
 */
async function expandSingleURL(url) {
  const finalUrl = await expandURL(url);
  if (finalUrl && finalUrl !== url) {
    return { original: url, final: finalUrl };
  }
  return { original: url, final: null, error: 'Could not expand' };
}

// ─── Message Handlers ─────────────────────────────────────────────

browser.runtime.onMessage.addListener((msg, sender) => {
  if (msg.type === 'shortener:expand') {
    return Promise.resolve(expandSingleURL(msg.payload.url));
  }
  return false;
});

// ─── Report Stats ────────────────────────────────────────────────

function reportStats(shortCount) {
  sendMessage('shortener:scan-results', {
    shortenedURLs: shortCount,
    timestamp: Date.now(),
  }).catch(() => { });
}

// ─── Init ─────────────────────────────────────────────────────────

export async function init() {
  const links = document.querySelectorAll('a[href]');
  let shortCount = 0;
  for (const link of links) {
    if (isShortened(link.href)) shortCount++;
  }
  reportStats(shortCount);
  scanAndAnnotate(); // fire and forget
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
