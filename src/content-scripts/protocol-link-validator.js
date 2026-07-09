/**
 * CleanClick - Protocol Link Validator (Content Script)
 *
 * 🟡 NEW MODULE - Phase 2
 *
 * Protects users from abuse of non-HTTP protocols:
 * - tel: - premium-rate number detection
 * - sms: - premium subscription detection
 * - intent:/facetime:/skype: - external app launch warnings
 * - mailto: - hidden email harvesting detection
 *
 * Runs at document_idle.
 */

import { MSG } from '../shared/constants.js';
import { sendMessage } from '../shared/messaging.js';
import { setHTML } from '../shared/i18n.js';

// ─── Premium Rate Prefixes (heuristic) ────────────────────────────

const PREMIUM_RATE_PREFIXES = [
  '900', '976', '976', '976', '976',
  '1-900', '1-976', '+1900', '+1976',
];

const PREMIUM_SMS_KEYWORDS = [
  'subscribe', 'sub', 'join', 'premium', 'paid', 'charge',
  'weekly', 'monthly', 'recurring', 'activate',
];

// ─── Protocol Categories ──────────────────────────────────────────

function categorizeProtocol(url) {
  try {
    const u = new URL(url);
    return { protocol: u.protocol.replace(':', ''), url: u };
  } catch {
    return { protocol: 'unknown', url: null };
  }
}

// ─── tel: Validation ──────────────────────────────────────────────

function validateTelLink(urlObj) {
  const phone = urlObj.pathname || urlObj.href.replace('tel:', '');
  const digits = phone.replace(/\D/g, '');

  const issues = [];

  // Check for premium rate prefixes
  for (const prefix of PREMIUM_RATE_PREFIXES) {
    if (digits.startsWith(prefix)) {
      issues.push({ type: 'premium-rate', detail: 'Premium-rate number detected (' + prefix + '...)' });
      break;
    }
  }

  // Check for unusual length
  if (digits.length > 15) {
    issues.push({ type: 'suspicious-length', detail: 'Unusually long phone number (' + digits.length + ' digits)' });
  }

  return {
    isRisky: issues.length > 0,
    issues,
    display: phone,
  };
}

// ─── sms: Validation ──────────────────────────────────────────────

function validateSmsLink(urlObj) {
  const body = urlObj.searchParams.get('body') || '';
  const issues = [];

  if (body) {
    const lower = body.toLowerCase();
    for (const keyword of PREMIUM_SMS_KEYWORDS) {
      if (lower.includes(keyword)) {
        issues.push({ type: 'premium-sms', detail: 'SMS body contains "' + keyword + '" (possible premium subscription)' });
        break;
      }
    }
  }

  return {
    isRisky: issues.length > 0,
    issues,
  };
}

// ─── mailto: Harvesting Detection ─────────────────────────────────

function validateMailtoLink(el, urlObj) {
  const email = urlObj.pathname || '';
  const issues = [];

  // Check if the link is hidden (delegates to hidden-link-scanner results)
  const styles = window.getComputedStyle(el);
  const isHidden = styles.display === 'none' || styles.visibility === 'hidden' ||
    parseFloat(styles.opacity) < 0.1 || el.offsetWidth < 5;

  if (isHidden) {
    issues.push({ type: 'hidden-mailto', detail: 'Hidden email link - possible harvesting' });
  }

  return {
    isRisky: issues.length > 0,
    issues,
    display: email,
  };
}

// ─── External App Launch Warning ──────────────────────────────────

function validateExternalAppLink(protocol, urlObj) {
  const issues = [];
  const appNames = {
    'intent': 'Android Intent',
    'facetime': 'FaceTime',
    'skype': 'Skype',
    'whatsapp': 'WhatsApp',
    'tg': 'Telegram',
    'viber': 'Viber',
    'zoommtg': 'Zoom',
    'callto': 'CallTo',
  };

  const appName = appNames[protocol] || protocol;
  issues.push({
    type: 'external-app',
    detail: 'Opens external application: ' + appName,
    appName: appName,
  });

  return { isRisky: true, issues };
}

// ─── Main Validation ──────────────────────────────────────────────

function validateLink(el) {
  const href = el.getAttribute('href') || el.href || '';
  if (!href) return null;

  const { protocol, url: urlObj } = categorizeProtocol(href);
  if (!urlObj) return null;

  // HTTP/HTTPS - handled by other modules
  if (protocol === 'http' || protocol === 'https') return null;

  let result;
  switch (protocol) {
    case 'tel':
      result = validateTelLink(urlObj);
      break;
    case 'sms':
      result = validateSmsLink(urlObj);
      break;
    case 'mailto':
      result = validateMailtoLink(el, urlObj);
      break;
    case 'intent':
    case 'facetime':
    case 'skype':
    case 'whatsapp':
    case 'tg':
    case 'viber':
    case 'zoommtg':
    case 'callto':
      result = validateExternalAppLink(protocol, urlObj);
      break;
    default:
      result = { isRisky: true, issues: [{ type: 'unknown-protocol', detail: 'Unknown protocol: ' + protocol }] };
  }

  return {
    href,
    protocol,
    ...result,
    element: el,
  };
}

// ─── UI: Confirmation Dialogs ─────────────────────────────────────

function showConfirmation(result) {
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;z-index:2147483647;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;';
  overlay.id = 'cleanclick-protocol-confirm';

  const reasons = result.issues.map(i => '<li>' + i.detail + '</li>').join('');
  const appWarning = result.protocol === 'tel' || result.protocol === 'sms' ? '' :
    '<p style="margin:4px 0;font-size:12px;color:#5b5b66">This will launch an external application.</p>';

  setHTML(overlay, '<div style="background:#fff;border-radius:8px;padding:24px;max-width:400px;box-shadow:0 4px 24px rgba(0,0,0,0.3));font-family:-apple-system,system-ui,sans-serif">' +
    '<h3 style="margin:0 0 8px;font-size:16px">' + (result.isRisky ? '\u26A0\uFE0F Suspicious Link' : '\u2139\uFE0F External Link') + '</h3>' +
    '<p style="margin:0 0 8px;font-size:12px;color:#5b5b66;word-break:break-all"><code>' + result.href + '</code></p>' +
    appWarning +
    '<ul style="margin:8px 0;padding-left:20px;font-size:13px">' + (result.issues.length > 0 ? reasons : '<li>No issues detected, but this protocol opens external software.</li>') + '</ul>' +
    '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px">' +
    '<button id="cleanclick-protocol-cancel" style="padding:8px 16px;background:#f5f5f7;border:1px solid #cfcfd8;border-radius:4px;cursor:pointer">Cancel</button>' +
    '<button id="cleanclick-protocol-allow" style="padding:8px 16px;background:#0060df;color:white;border:none;border-radius:4px;cursor:pointer">Proceed</button>' +
    '</div></div>');

  document.body.appendChild(overlay);

  return new Promise((resolve) => {
    document.getElementById('cleanclick-protocol-cancel').onclick = () => { overlay.remove(); resolve(false); };
    document.getElementById('cleanclick-protocol-allow').onclick = () => { overlay.remove(); resolve(true); };
  });
}

// ─── Click Interception ──────────────────────────────────────────

document.addEventListener('click', async (e) => {
  const link = e.target.closest('a, area');
  if (!link) return;

  const result = validateLink(link);
  if (!result) return;

  if (result.isRisky) {
    e.preventDefault();
    e.stopPropagation();

    const allowed = await showConfirmation(result);
    if (allowed) {
      // Navigate to the original href
      window.location.href = result.href;
    }
  } else if (result.issues.length > 0) {
    // Informational - still warn but less intrusive
    e.preventDefault();
    const allowed = await showConfirmation(result);
    if (allowed) {
      window.location.href = result.href;
    }
  }

  // Log
  sendMessage('protocol:link-validated', {
    href: result.href,
    protocol: result.protocol,
    issues: result.issues,
    timestamp: Date.now(),
  }).catch(() => { });
}, true);

// ─── Scan on Load ─────────────────────────────────────────────────

function scanNonHTTPLinks() {
  const links = document.querySelectorAll('a[href]');
  const results = [];

  for (const link of links) {
    const result = validateLink(link);
    if (result) {
      results.push(result);
    }
  }

  if (results.length > 0) {
    sendMessage('protocol:scan-results', {
      totalNonHTTP: results.length,
      risky: results.filter(r => r.isRisky).length,
      results: results.map(r => ({ href: r.href, protocol: r.protocol, isRisky: r.isRisky, issues: r.issues })),
      timestamp: Date.now(),
    }).catch(() => { });
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', scanNonHTTPLinks);
} else {
  scanNonHTTPLinks();
}
