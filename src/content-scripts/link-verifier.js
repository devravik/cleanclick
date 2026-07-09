/**
 * CleanClick - Link Verifier (Content Script)
 *
 * 🔴 CRITICAL MODULE
 *
 * Detects link spoofing - when the visible representation of a link
 * differs from its actual destination. Six detection modules:
 *
 * A. Hover Spoofing Detection - href mutation between hover and click
 * B. Link Text vs Href Discrepancy - displayed text domain ≠ href domain
 * C. Punycode/IDN Homograph Detection - mixed-script lookalike domains
 * D. Base Tag Hijacking Detection - <base> pointing to external domain
 * E. JavaScript / Data / Blob URI Detection - non-navigation protocols
 * F. Subdomain Confusion Detection - brand names in subdomain position
 *
 * Integrates with link-classifier.js for unified risk scoring.
 */

import { MSG } from '../shared/constants.js';
import { sendMessage } from '../shared/messaging.js';
import {
  parseURL, getDomainParts, isSameDomain,
  detectHomograph, detectInvisibleChars, detectBidiOverrides,
} from '../shared/utils.js';
import { classifyURL } from '../shared/link-classifier.js';

// ─── A. Hover Spoofing Detection ───────────────────────────────────

/**
 * Track href at hover time vs click time to detect dynamic mutation.
 */
class HoverSpoofDetector {
  constructor() {
    this._hoverState = new WeakMap(); // element -> { hrefAtHover, hrefAtMouseDown, timestamp }
    this._setupListeners();
  }

  _setupListeners() {
    // Capture href on mouseover
    document.addEventListener('mouseover', (e) => {
      const link = this._findLink(e.target);
      if (link && link.href) {
        this._hoverState.set(link, {
          hrefAtHover: link.href,
          hrefAtMouseDown: null,
          timestamp: Date.now(),
        });
      }
    }, true);

    // Capture href on mousedown (right before click)
    document.addEventListener('mousedown', (e) => {
      const link = this._findLink(e.target);
      if (link && link.href && this._hoverState.has(link)) {
        const state = this._hoverState.get(link);
        state.hrefAtMouseDown = link.href;
      }
    }, true);
  }

  /**
   * Check if a link's href was mutated between hover and click.
   * @param {Element} link
   * @returns {{ isMutated: boolean, hrefAtHover: string|null, currentHref: string|null }}
   */
  checkMutation(link) {
    const state = this._hoverState.get(link);
    if (!state) return { isMutated: false, hrefAtHover: null, currentHref: link?.href || null };

    const hrefNow = link.href;
    let isMutated = false;

    if (state.hrefAtMouseDown && state.hrefAtMouseDown !== hrefNow) {
      // Mutated between mousedown and now
      isMutated = true;
    } else if (state.hrefAtHover !== hrefNow) {
      // Mutated between hover and now
      isMutated = true;
    }

    return {
      isMutated,
      hrefAtHover: state.hrefAtHover,
      currentHref: hrefNow,
    };
  }

  _findLink(target) {
    if (target.tagName === 'A' || target.tagName === 'AREA') return target;
    return target.closest('a');
  }
}

// ─── B. Link Text vs Href Discrepancy ─────────────────────────────

/**
 * Check if the visible text of a link contains a domain
 * that differs from the href's domain.
 * @param {HTMLAnchorElement} el
 * @returns {{ hasDiscrepancy: boolean, textDomain: string|null, hrefDomain: string|null, severity: 'low'|'high' }}
 */
function checkTextHrefDiscrepancy(el) {
  const text = (el.textContent || '').trim();
  const title = el.getAttribute('aria-label') || el.getAttribute('title') || '';
  const displayText = title || text;

  if (!displayText) return { hasDiscrepancy: false, textDomain: null, hrefDomain: null, severity: 'low' };

  // Extract domain from displayed text
  const textDomain = extractDomainFromText(displayText);
  if (!textDomain) return { hasDiscrepancy: false, textDomain: null, hrefDomain: null, severity: 'low' };

  // Get href domain
  const href = el.href || '';
  if (!href) return { hasDiscrepancy: false, textDomain: null, hrefDomain: null, severity: 'low' };

  const parsed = parseURL(href);
  if (!parsed) return { hasDiscrepancy: false, textDomain: null, hrefDomain: null, severity: 'low' };

  const hrefDomain = parsed.hostname;

  // Compare - handle www vs non-www
  const normalizedText = textDomain.replace(/^www\./, '');
  const normalizedHref = hrefDomain.replace(/^www\./, '');

  if (normalizedText === normalizedHref) {
    return { hasDiscrepancy: false, textDomain, hrefDomain, severity: 'low' };
  }

  // Check if any part of the href domain appears in the text
  const hrefDomainLower = normalizedHref.toLowerCase();
  if (displayText.toLowerCase().includes(hrefDomainLower)) {
    // Text contains the actual domain - could be supplementary info
    return { hasDiscrepancy: false, textDomain, hrefDomain, severity: 'low' };
  }

  // Determine severity
  const textParts = getDomainParts(normalizedText);
  const hrefParts = getDomainParts(normalizedHref);

  const severity = (textParts.domain !== hrefParts.domain || textParts.tld !== hrefParts.tld) ? 'high' : 'low';

  return {
    hasDiscrepancy: true,
    textDomain,
    hrefDomain,
    severity,
  };
}

/**
 * Extract a domain-like string from arbitrary text.
 */
function extractDomainFromText(text) {
  // Try URL pattern first
  const urlMatch = text.match(/https?:\/\/([^\s/]+)/i);
  if (urlMatch) return urlMatch[1].toLowerCase();

  // Try domain pattern (example.com, sub.example.co.uk)
  const domainMatch = text.match(/([a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}/);
  if (domainMatch) return domainMatch[0].toLowerCase();

  return null;
}

// ─── C. Homograph Detection ────────────────────────────────────────

/**
 * Check a single URL for homograph/confusable characters.
 * @param {string} url
 * @returns {{ isHomograph: boolean, normalizedDomain: string, issues: string[] }}
 */
function checkHomograph(url) {
  const parsed = parseURL(url);
  if (!parsed) return { isHomograph: false, normalizedDomain: '', issues: [] };

  const issues = [];

  // Check hostname for homographs
  const homograph = detectHomograph(parsed.hostname);
  if (homograph.isHomograph) {
    issues.push(`Homograph characters: ${homograph.confusablesFound.join(', ')}`);
  }

  // Check for invisible characters
  const invisible = detectInvisibleChars(parsed.hostname);
  if (invisible.found) {
    issues.push(`Invisible unicode characters at positions: ${invisible.chars.map(c => c.position).join(', ')}`);
  }

  // Check for bidi overrides
  const bidi = detectBidiOverrides(url);
  if (bidi.found) {
    issues.push(`Bidirectional override characters at positions: ${bidi.positions.join(', ')}`);
  }

  return {
    isHomograph: issues.length > 0,
    normalizedDomain: homograph.normalized,
    issues,
  };
}

// ─── D. Base Tag Hijacking Detection ───────────────────────────────

/**
 * Check if the page's <base> tag hijacks relative URLs.
 * @returns {{ isHijacked: boolean, baseHref: string, pageOrigin: string, affectedLinks: number }}
 */
function checkBaseTag() {
  const baseEl = document.querySelector('base');
  if (!baseEl || !baseEl.href) return { isHijacked: false, baseHref: '', pageOrigin: window.location.origin, affectedLinks: 0 };

  const baseOrigin = parseURL(baseEl.href)?.origin;
  if (!baseOrigin) return { isHijacked: false, baseHref: baseEl.href, pageOrigin: window.location.origin, affectedLinks: 0 };

  if (baseOrigin !== window.location.origin) {
    // Count potentially affected links
    const allLinks = document.querySelectorAll('a');
    let affected = 0;
    for (const link of allLinks) {
      const href = link.getAttribute('href');
      if (href && !href.startsWith('http') && !href.startsWith('//') && !href.startsWith('#') && !href.startsWith('moz-extension://')) {
        affected++;
      }
    }

    return {
      isHijacked: true,
      baseHref: baseEl.href,
      pageOrigin: window.location.origin,
      affectedLinks: affected,
    };
  }

  return { isHijacked: false, baseHref: baseEl.href, pageOrigin: window.location.origin, affectedLinks: 0 };
}

// ─── E. JavaScript / Data / Blob URI Detection ─────────────────────

/**
 * Check for non-navigation protocols.
 * @param {HTMLAnchorElement} el
 * @returns {{ isNonStandard: boolean, protocol: string, severity: 'low'|'high' }}
 */
function checkProtocolUsage(el) {
  const href = el.getAttribute('href') || el.href || '';
  if (!href) return { isNonStandard: false, protocol: '', severity: 'low' };

  const protocol = href.split(':')[0]?.toLowerCase() || '';

  switch (protocol) {
    case 'javascript':
      return { isNonStandard: true, protocol, severity: 'high' };
    case 'data':
      return { isNonStandard: true, protocol, severity: 'high' };
    case 'blob':
      return { isNonStandard: true, protocol, severity: 'medium' };
    default:
      return { isNonStandard: false, protocol, severity: 'low' };
  }
}

// ─── F. Subdomain Confusion Detection ──────────────────────────────

/**
 * Check if a URL uses brand names in subdomain position to deceive.
 * @param {string} url
 * @returns {{ isConfused: boolean, brandDetected: string|null }}
 */
function checkSubdomainConfusion(url) {
  const parsed = parseURL(url);
  if (!parsed) return { isConfused: false, brandDetected: null };

  const parts = getDomainParts(parsed.hostname);
  if (!parts.subdomain) return { isConfused: false, brandDetected: null };

  // Common brands that appear in subdomain confusion attacks
  const brands = [
    'google', 'facebook', 'youtube', 'amazon', 'paypal', 'apple',
    'microsoft', 'netflix', 'instagram', 'twitter', 'whatsapp',
    'telegram', 'discord', 'github', 'stackoverflow', 'linkedin',
    'reddit', 'spotify', 'twitch', 'medium', 'wordpress',
    'cloudflare', 'mozilla', 'firefox', 'adobe', 'dropbox',
  ];

  const subLabels = parts.subdomain.split('.');
  for (const label of subLabels) {
    const lower = label.toLowerCase();
    if (brands.includes(lower)) {
      return {
        isConfused: true,
        brandDetected: lower,
      };
    }
  }

  return { isConfused: false, brandDetected: null };
}

// ─── Main Verification Engine ──────────────────────────────────────

/**
 * Run all verification checks on a single link element.
 * @param {HTMLAnchorElement} el
 * @param {HoverSpoofDetector} hoverDetector
 * @returns {Object} Verification result with risk flags
 */
function verifyLink(el, hoverDetector) {
  const href = el.href || '';
  const text = el.textContent?.trim() || '';
  const flags = [];

  // A. Hover spoofing
  const mutation = hoverDetector.checkMutation(el);
  if (mutation.isMutated) {
    flags.push({
      type: 'hover-mutation',
      severity: 'high',
      detail: `Href changed from "${mutation.hrefAtHover}" to "${mutation.currentHref}"`,
    });
  }

  // B. Text vs href discrepancy
  const discrepancy = checkTextHrefDiscrepancy(el);
  if (discrepancy.hasDiscrepancy) {
    flags.push({
      type: 'text-href-mismatch',
      severity: discrepancy.severity,
      detail: `Text shows "${discrepancy.textDomain}" but href points to "${discrepancy.hrefDomain}"`,
    });
  }

  // C. Homograph check
  const homograph = checkHomograph(href);
  if (homograph.isHomograph) {
    flags.push({
      type: 'homograph',
      severity: 'high',
      detail: homograph.issues.join('; '),
    });
  }

  // E. Protocol check
  const protocol = checkProtocolUsage(el);
  if (protocol.isNonStandard) {
    flags.push({
      type: 'non-standard-protocol',
      severity: protocol.severity,
      detail: `Uses ${protocol.protocol}: protocol`,
    });
  }

  // F. Subdomain confusion
  const confusion = checkSubdomainConfusion(href);
  if (confusion.isConfused) {
    flags.push({
      type: 'subdomain-confusion',
      severity: 'medium',
      detail: `Brand "${confusion.brandDetected}" appears in subdomain position`,
    });
  }

  // Get overall risk score from classifier
  const classification = classifyURL(href, { displayText: text });

  return {
    href,
    text,
    flags,
    riskScore: classification.riskScore,
    riskLevel: classification.riskLevel,
    reasons: classification.reasons,
  };
}

// ─── Batch Scan ────────────────────────────────────────────────────

/**
 * Verify all links on the page.
 * Returns results grouped by risk level.
 */
export async function verifyAllLinks() {
  const startTime = performance.now();

  const hoverDetector = new HoverSpoofDetector();
  const results = [];
  const links = document.querySelectorAll('a[href]');

  // D. Base tag check (page-level, done once)
  const baseTagIssue = checkBaseTag();
  let baseTagFlags = [];
  if (baseTagIssue.isHijacked) {
    baseTagFlags.push({
      type: 'base-tag-hijack',
      severity: 'critical',
      detail: `<base href="${baseTagIssue.baseHref}"> hijacks ${baseTagIssue.affectedLinks} relative links`,
    });
  }

  for (const link of links) {
    const result = verifyLink(link, hoverDetector);

    // Attach base tag hijack info if applicable
    if (baseTagIssue.isHijacked) {
      const href = link.getAttribute('href');
      if (href && !href.startsWith('http') && !href.startsWith('//') && !href.startsWith('#')) {
        result.flags.push(...baseTagFlags);
        result.reasons.push(`Relative link potentially hijacked by <base href="${baseTagIssue.baseHref}">`);
        result.riskScore = Math.min(100, result.riskScore + 30);
        result.riskLevel = result.riskScore > 60 ? 'dangerous' : 'suspicious';
      }
    }

    results.push(result);
  }

  // Send summary to background
  const summary = {
    total: results.length,
    dangerous: results.filter(r => r.riskLevel === 'dangerous').length,
    suspicious: results.filter(r => r.riskLevel === 'suspicious').length,
    safe: results.filter(r => r.riskLevel === 'safe').length,
    baseTagHijack: baseTagIssue.isHijacked,
    timestamp: Date.now(),
  };

  sendMessage('link:verification-summary', summary).catch(() => { });

  const duration = performance.now() - startTime;

  return { results, summary, duration, baseTagIssue };
}

// ─── Auto-init ─────────────────────────────────────────────────────

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    requestIdleCallback(() => verifyAllLinks(), { timeout: 5000 });
  });
} else {
  requestIdleCallback(() => verifyAllLinks(), { timeout: 5000 });
}
