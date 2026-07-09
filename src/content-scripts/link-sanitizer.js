/**
 * CleanClick - Link Sanitizer (Content Script)
 *
 * 🟡 NEW MODULE - Phase 2
 *
 * Cleans links before the user clicks them:
 * - Strips tracking parameters (utm_, fbclid, gclid, etc.)
 * - Detects affiliate links
 * - Pre-fetches redirect chains for shortened URLs
 *
 * Runs at document_idle.
 */

import { TRACKING_PARAMS, SHORTENER_DOMAINS, MSG } from '../shared/constants.js';
import { sendMessage } from '../shared/messaging.js';
import { stripTrackingParams } from '../shared/utils.js';

// ─── State ─────────────────────────────────────────────────────────

const sanitizedCount = { total: 0 };

// ─── A. Tracking Parameter Stripping ──────────────────────────────

/**
 * Strip tracking params from a URL and return both original and cleaned.
 */
function sanitizeURL(url) {
  if (!url) return { original: url, cleaned: url, wasCleaned: false };

  const cleaned = stripTrackingParams(url, TRACKING_PARAMS);
  return {
    original: url,
    cleaned,
    wasCleaned: cleaned !== url,
  };
}

// ─── B. Affiliate Link Detection ──────────────────────────────────

const AFFILIATE_PATTERNS = [
  /\/(?:ref|referral|aff)\//i,
  /[?&](?:tag|aff|affiliate|ref|referral)=/i,
  /\/gp\/[^/]+\/ref=/i, // Amazon affiliate
  /aliaz\.net/i,
  /skimlinks\.com/i,
  /viglink\.com/i,
  /affiliatly\.com/i,
  /shareasale\.com/i,
  /cj\.com/i,
  /rakuten\.com/i,
  /linksynergy\.com/i,
];

function detectAffiliate(url) {
  for (const pattern of AFFILIATE_PATTERNS) {
    if (pattern.test(url)) {
      return { isAffiliate: true, matchedPattern: pattern.source };
    }
  }
  return { isAffiliate: false, matchedPattern: null };
}

// ─── C. Redirect Chain Pre-fetch ─────────────────────────────────

/**
 * Cache for expanded short URLs.
 * Map<string, { finalUrl: string, chainLength: number, timestamp: number }>
 */
const expansionCache = new Map();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

/**
 * Check if a URL belongs to a known shortener and pre-fetch the redirect.
 */
async function expandShortURL(url) {
  try {
    const u = new URL(url);
    const isShortener = SHORTENER_DOMAINS.has(u.hostname) ||
      SHORTENER_DOMAINS.has(u.hostname.replace(/^www\./, ''));
    if (!isShortener) return null;

    // Check cache
    const cached = expansionCache.get(url);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached;
    }

    // Pre-fetch with HEAD request
    const response = await fetch(url, { method: 'HEAD', redirect: 'follow' });
    const finalUrl = response.url || url;
    const result = {
      finalUrl,
      chainLength: 0, // browser follows redirects automatically
      timestamp: Date.now(),
    };

    expansionCache.set(url, result);
    return result;
  } catch {
    return null;
  }
}

// ─── D. Click Interception ───────────────────────────────────────

document.addEventListener('click', async (e) => {
  const link = e.target.closest('a[href]');
  if (!link) return;

  const href = link.href || '';
  if (!href || href.startsWith('javascript:')) return;

  const result = sanitizeURL(href);

  if (result.wasCleaned) {
    // Update link href to cleaned version
    sanitizedCount.total++;

    // Show subtle indicator
    showSanitizedIndicator(link, result.original, result.cleaned);

    // Update the href so the click goes to the clean URL
    link.href = result.cleaned;
  }

  // Check for affiliate
  const affiliate = detectAffiliate(href);
  if (affiliate.isAffiliate) {
    showAffiliateIndicator(link);
  }

  // Expand short URLs
  const expanded = await expandShortURL(href);
  if (expanded && expanded.finalUrl !== href) {
    showExpandedIndicator(link, expanded.finalUrl);
  }
}, true);

// ─── E. UI Indicators ────────────────────────────────────────────

function showSanitizedIndicator(link, original, cleaned) {
  // Brief green flash on the link
  const origBg = link.style.backgroundColor;
  link.style.transition = 'background-color 0.5s';
  link.style.backgroundColor = 'rgba(46, 125, 50, 0.15)';
  setTimeout(() => { link.style.backgroundColor = origBg || ''; }, 1000);

  // Tooltip enhancement via the link title
  const existing = link.getAttribute('title') || '';
  const cleanMsg = 'CleanClick: Tracking params removed.';
  link.setAttribute('title', (existing ? existing + ' | ' : '') + cleanMsg);
}

function showAffiliateIndicator(link) {
  link.style.outline = '1px dashed #f57c00';
  const existing = link.getAttribute('title') || '';
  const affMsg = 'Contains affiliate tracking.';
  link.setAttribute('title', (existing ? existing + ' | ' : '') + affMsg);
}

function showExpandedIndicator(link, finalUrl) {
  const existing = link.getAttribute('title') || '';
  const expandMsg = 'Short URL expands to: ' + finalUrl;
  link.setAttribute('title', (existing ? existing + ' | ' : '') + expandMsg);

  // Log
  sendMessage('sanitizer:short-url-expanded', {
    original: link.href,
    finalUrl,
    timestamp: Date.now(),
  }).catch(() => { });
}

// ─── Auto-scan on Load ───────────────────────────────────────────

function scanAllLinks() {
  const links = document.querySelectorAll('a[href]');
  let totalCleaned = 0;
  let totalAffiliate = 0;
  let totalShortened = 0;

  for (const link of links) {
    const href = link.href || '';
    if (!href || href.startsWith('javascript:')) continue;

    const result = sanitizeURL(href);
    if (result.wasCleaned) {
      totalCleaned++;
      // We don't modify hrefs on page load - only on click
    }

    if (detectAffiliate(href).isAffiliate) {
      totalAffiliate++;
    }

    if (SHORTENER_DOMAINS.has(new URL(href).hostname.replace(/^www\./, ''))) {
      totalShortened++;
    }
  }

  if (totalCleaned > 0 || totalAffiliate > 0 || totalShortened > 0) {
    sendMessage('sanitizer:scan-results', {
      totalCleaned,
      totalAffiliate,
      totalShortened,
      timestamp: Date.now(),
    }).catch(() => { });
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', scanAllLinks);
} else {
  scanAllLinks();
}
