/**
 * CleanClick — Link Risk Classifier
 *
 * Assigns a risk score (0–100) to any URL or link element.
 * Used by hidden-link-scanner, link-verifier, and link-transparency-ui.
 *
 * Pure functions — no browser API dependencies.
 */

import { RISK, LINK_CLASS } from './constants.js';
import {
  parseURL, getDomainParts, isSameDomain, isShortenedURL,
  detectHomograph, detectInvisibleChars, levenshteinDistance,
  checkProtocol,
} from './utils.js';

// ─── Classification Result ─────────────────────────────────────────

/**
 * @typedef {Object} Classification
 * @property {number} riskScore - 0–100
 * @property {'safe'|'suspicious'|'dangerous'} riskLevel
 * @property {string[]} reasons - Human-readable reasons
 * @property {string} url - The classified URL
 * @property {Object} [details] - Extra info for debugging/UI
 */

// ─── Main Classifier ───────────────────────────────────────────────

/**
 * Classify a URL and return a risk score with reasons.
 * @param {string} url - The URL to classify
 * @param {Object} [options]
 * @param {string} [options.displayText] - The visible link text (for mismatch detection)
 * @param {Set<string>} [options.shortenerDomains] - Known URL shorteners
 * @param {string[]} [options.popularDomains] - Top domains for typosquatting check
 * @returns {Classification}
 */
export function classifyURL(url, options = {}) {
  const reasons = [];
  let score = RISK.DEFAULT_SCORE;

  const parsed = parseURL(url);
  if (!parsed) {
    return {
      riskScore: 60,
      riskLevel: 'suspicious',
      reasons: ['Invalid URL format'],
      url,
    };
  }

  // 1. Protocol check
  const protocolCheck = checkProtocol(url);
  if (protocolCheck.isNonStandard) {
    if (protocolCheck.protocol === 'javascript') {
      score += 30;
      reasons.push('Uses javascript: protocol (code execution)');
    } else if (protocolCheck.protocol === 'data') {
      score += 25;
      reasons.push('Uses data: URI (may contain hidden content)');
    } else if (protocolCheck.protocol === 'blob') {
      score += 15;
      reasons.push('Uses blob: URL (dynamically created content)');
    } else {
      score += 10;
      reasons.push(`Non-standard protocol: ${protocolCheck.protocol}`);
    }
  }

  // 2. Short URL detection
  if (options.shortenerDomains) {
    if (isShortenedURL(url, options.shortenerDomains)) {
      score += 15;
      reasons.push('URL shortened — destination hidden');
    }
  }

  // 3. Homograph detection
  const homograph = detectHomograph(parsed.hostname);
  if (homograph.isHomograph) {
    score += 35;
    reasons.push(`Homograph characters detected: ${homograph.confusablesFound.join(', ')}`);
  }

  // 4. Invisible characters
  const invisible = detectInvisibleChars(parsed.hostname);
  if (invisible.found) {
    score += 30;
    reasons.push('Invisible unicode characters in domain');
  }

  // 5. Typosquatting check
  const popularDomains = options.popularDomains || LINK_CLASS.POPULAR_DOMAINS;
  const parts = getDomainParts(parsed.hostname);
  const fullDomain = `${parts.domain}.${parts.tld}`;

  for (const popular of popularDomains) {
    const dist = levenshteinDistance(fullDomain, popular);
    if (dist === 1 && fullDomain !== popular) {
      score += 20;
      reasons.push(`Domain is 1 character different from ${popular} (typosquatting)`);
      break;
    } else if (dist === 2 && fullDomain !== popular) {
      score += 10;
      reasons.push(`Domain is similar to ${popular} (possible typosquatting)`);
      break;
    }
  }

  // 6. Display text vs href mismatch
  if (options.displayText) {
    const textDomain = extractDomainFromText(options.displayText);
    if (textDomain && !isSameDomain(`https://${textDomain}`, url)) {
      score += 25;
      reasons.push(`Link text shows "${textDomain}" but destination is ${parsed.hostname}`);
    }
  }

  // 7. Subdomain brand confusion
  if (parts.subdomain) {
    const subLabels = parts.subdomain.split('.');
    for (const label of subLabels) {
      if (popularDomains.some(p => p.startsWith(label))) {
        score += 15;
        reasons.push(`Brand name "${label}" appears as subdomain of ${parts.domain}.${parts.tld}`);
        break;
      }
    }
  }

  // 8. Suspicious TLD
  const suspiciousTLDs = ['.tk', '.ml', '.ga', '.cf', '.gq', '.xyz', '.top', '.work', '.click', '.download', '.review', '.trade', '.bid', '.date', '.webcam', '.men', '.loan', '.win', '.mom', '.party'];
  if (suspiciousTLDs.some(tld => parts.full.endsWith(tld))) {
    score += 10;
    reasons.push(`Suspicious TLD: .${parts.tld}`);
  }

  // Clamp score
  score = Math.max(0, Math.min(100, score));

  return {
    riskScore: score,
    riskLevel: score <= RISK.SAFE_MAX ? 'safe' : score <= RISK.SUSPICIOUS_MAX ? 'suspicious' : 'dangerous',
    reasons,
    url,
    details: {
      hostname: parsed.hostname,
      domain: parts.domain,
      tld: parts.tld,
      homograph: homograph.isHomograph,
    },
  };
}

/**
 * Classify a DOM anchor element.
 * @param {HTMLAnchorElement|HTMLAreaElement} element
 * @param {Object} [options]
 * @returns {Classification}
 */
export function classifyLinkElement(element, options = {}) {
  const href = element.href || '';
  const text = element.textContent?.trim() || element.getAttribute('aria-label') || '';
  const title = element.getAttribute('title') || '';

  return classifyURL(href, {
    ...options,
    displayText: text || title || undefined,
  });
}

/**
 * Batch classify multiple URLs.
 * @param {string[]} urls
 * @param {Object} [options]
 * @returns {Map<string, Classification>}
 */
export function classifyURLs(urls, options = {}) {
  const results = new Map();
  for (const url of urls) {
    results.set(url, classifyURL(url, options));
  }
  return results;
}

// ─── Helpers ───────────────────────────────────────────────────────

/**
 * Try to extract a domain from arbitrary text.
 * @param {string} text
 * @returns {string|null}
 */
function extractDomainFromText(text) {
  // Match common URL patterns and domain-like strings
  const urlMatch = text.match(/https?:\/\/([^\s/]+)/i);
  if (urlMatch) return urlMatch[1];

  const domainMatch = text.match(/([a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}/);
  if (domainMatch) return domainMatch[0];

  return null;
}
