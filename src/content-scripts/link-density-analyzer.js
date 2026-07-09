/**
 * CleanClick - Link Density Analyzer (Content Script)
 *
 * 🟢 MODULE - Phase 3 (standalone)
 *
 * Detects SEO spam pages, link farms, and keyword-stuffed link sections
 * by analyzing link density metrics:
 * - Total link count per page / per viewport
 * - Link-to-text ratio
 * - Outbound link uniqueness
 * - Keyword frequency in link text
 *
 * Runs at document_idle.
 */

import { sendMessage } from '../shared/messaging.js';

/**
 * Analyze link density for the current page.
 */
export function analyzeDensity() {
  const allLinks = Array.from(document.querySelectorAll('a[href]'));
  const totalLinks = allLinks.length;

  // Count unique external domains
  const externalDomains = new Set();
  const externalLinks = [];

  for (const link of allLinks) {
    try {
      const u = new URL(link.href);
      if (u.origin !== window.location.origin) {
        externalDomains.add(u.hostname);
        externalLinks.push({ href: link.href, domain: u.hostname, text: (link.textContent || '').trim() });
      }
    } catch { }
  }

  // Calculate link-to-text ratio
  const bodyText = document.body?.innerText || '';
  const textLength = bodyText.length;
  // Approximate link text length
  let linkTextLength = 0;
  const linkTexts = [];
  for (const link of allLinks) {
    const t = (link.textContent || '').trim();
    linkTextLength += t.length;
    if (t.length > 2) linkTexts.push(t);
  }
  const linkToTextRatio = textLength > 0 ? linkTextLength / textLength : 0;

  // Keyword frequency in link text
  const wordFreq = {};
  for (const text of linkTexts) {
    const words = text.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    for (const word of words) {
      wordFreq[word] = (wordFreq[word] || 0) + 1;
    }
  }
  // Find most repeated keywords
  const sortedWords = Object.entries(wordFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  const repeatedKeywords = sortedWords.filter(([word, count]) => count > 3);
  const hasKeywordStuffing = repeatedKeywords.length > 3;

  // Count outbound to unrelated domains (heuristic: >3 different domains)
  const hasManyOutbound = externalDomains.size > 20;

  // Assess overall risk
  const issues = [];
  if (totalLinks > 100) issues.push({ type: 'high-link-count', detail: totalLinks + ' links on page' });
  if (linkToTextRatio > 0.5) issues.push({ type: 'high-link-ratio', detail: Math.round(linkToTextRatio * 100) + '% of text is link text' });
  if (hasManyOutbound) issues.push({ type: 'many-outbound-domains', detail: externalDomains.size + ' unique external domains' });
  if (hasKeywordStuffing) {
    const top = repeatedKeywords.slice(0, 3).map(([w, c]) => w + '(' + c + 'x)').join(', ');
    issues.push({ type: 'keyword-stuffing', detail: 'Repeated link text: ' + top });
  }

  const densityLevel = issues.length === 0 ? 'normal' : issues.length <= 2 ? 'elevated' : 'high';

  const result = {
    totalLinks,
    uniqueExternalDomains: externalDomains.size,
    linkToTextRatio: Math.round(linkToTextRatio * 100) / 100,
    topKeywords: sortedWords.slice(0, 5),
    repeatedKeywords: repeatedKeywords.slice(0, 5),
    densityLevel,
    issues,
    timestamp: Date.now(),
  };

  // Send to background for popup display
  sendMessage('density:scan-results', result).catch(() => { });

  return result;
}

/**
 * Check if the page exceeds density thresholds and warn if so.
 */
function checkAndWarn() {
  const result = analyzeDensity();

  if (result.densityLevel === 'high') {
    // Show subtle indicator in the page
    const banner = document.createElement('div');
    banner.id = 'cleanclick-density-warning';
    banner.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:2147483647;' +
      'background:#fff3cd;color:#856404;padding:8px 16px;font-family:-apple-system,system-ui,sans-serif;' +
      'font-size:12px;display:flex;align-items:center;gap:8px;';
    banner.innerHTML =
      '<span>\u26A0\uFE0F</span>' +
      '<span><strong>High link density:</strong> ' + result.totalLinks + ' links to ' + result.uniqueExternalDomains + ' domains detected.</span>' +
      '<button onclick="this.parentElement.remove()" style="margin-left:auto;padding:4px 8px;background:#856404;color:white;border:none;border-radius:4px;cursor:pointer">OK</button>';
    document.body.prepend(banner);

    // Auto-hide after 8s
    setTimeout(() => {
      const el = document.getElementById('cleanclick-density-warning');
      if (el) el.remove();
    }, 8000);
  }
}

// ─── Init ─────────────────────────────────────────────────────────

export function init() {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      analyzeDensity();
      checkAndWarn();
    });
  } else {
    analyzeDensity();
    checkAndWarn();
  }
}

init();
