/**
 * CleanClick — Fake Download Button Detection (Content Script)
 *
 * Scans the page for download buttons and scores them.
 * Badges only shown when user enables showTooltips in settings.
 */

import { MSG } from '../shared/constants.js';
import { sendMessage } from '../shared/messaging.js';
import { isSameDomain } from '../shared/utils.js';

function scoreDownloadButton(el) {
  let score = 0;
  const reasons = [];

  if (el.hasAttribute('download')) { score += 2; reasons.push('has download attribute'); }

  if (el.href) {
    if (isSameDomain(el.href, window.location.href)) { score += 2; reasons.push('same-origin'); }
    const safeExts = ['.zip','.gz','.tar','.7z','.rar','.pdf','.exe','.msi','.dmg','.apk','.deb','.rpm','.mp3','.mp4','.avi','.mkv','.iso'];
    const path = (el.pathname || el.getAttribute('href') || '').toLowerCase();
    if (safeExts.some(ext => path.endsWith(ext))) { score += 1; reasons.push('known file extension'); }
    if (path.match(/\/[^/]+\.[a-z0-9]{2,4}$/i)) { score += 1; reasons.push('has filename'); }
  }

  const classes = (el.className || '').toLowerCase();
  const id = (el.id || '').toLowerCase();
  const href = el.href || '';

  const adPatterns = ['ad-','ad_','advert','sponsor','promo','banner','click'];
  for (const p of adPatterns) {
    if (classes.includes(p) || id.includes(p)) { score -= 2; reasons.push('ad class: ' + p); break; }
  }

  try { if (window.self !== window.top) { score -= 1; reasons.push('inside iframe'); } } catch {}

  if (href && !isSameDomain(href, window.location.href)) { score -= 1; reasons.push('cross-domain'); }

  const adDomains = ['adserver','adsterra','propellerads','popads','clickadu','mgid','exoclick','trafficfactory'];
  if (href) {
    try { const h = new URL(href).hostname; if (adDomains.some(d => h.includes(d))) { score -= 3; reasons.push('ad domain: ' + h); } } catch {}
  }

  return { score, reasons, isLegitimate: score > 2 };
}

function findDownloadButtons() {
  const candidates = new Set();
  const selectors = [
    'a[download]', 'a[href$=".zip"]','a[href$=".exe"]','a[href$=".msi"]','a[href$=".dmg"]',
    'a[href$=".apk"]','a[href$=".deb"]','a[href$=".rar"]','a[href$=".7z"]','a[href$=".tar.gz"]',
    'a[href$=".pdf"]','a[href$=".mp3"]','a[href$=".mp4"]',
    'a[href*="download"]','button[id*="download"]','button[class*="download"]',
    'a[id*="download"]','a[class*="download"]',
    '[aria-label*="download" i]','[title*="download" i]',
    'a[href*="/dl/"]','a[href*="/get/"]','a[href*="/file/"]',
  ];
  for (const s of selectors) {
    try { document.querySelectorAll(s).forEach(el => candidates.add(el)); } catch {}
  }
  return [...candidates];
}

function addBadges() {
  const buttons = findDownloadButtons();
  for (const btn of buttons) {
    if (btn.querySelector('.cleanclick-download-badge')) continue;
    const { score, reasons, isLegitimate } = scoreDownloadButton(btn);
    const badge = document.createElement('span');
    badge.className = 'cleanclick-download-badge';
    badge.style.cssText =
      'display:inline-flex;align-items:center;gap:4px;font-size:11px;' +
      'font-family:-apple-system,system-ui,sans-serif;padding:2px 6px;border-radius:4px;' +
      'margin-left:4px;font-weight:600;cursor:default;' +
      (isLegitimate ? 'background:#e8f5e9;color:#2e7d32;' : 'background:#ffebee;color:#c62828;');
    badge.textContent = isLegitimate ? 'Safe' : 'Suspicious';
    badge.title = 'score: ' + score + '\n' + reasons.join('\n');
    if (btn.tagName === 'A') { btn.parentNode?.insertBefore(badge, btn.nextSibling); }
    else { btn.appendChild(badge); }
  }
}

function reportStats(buttons, results) {
  sendMessage('download-buttons:scan', {
    total: buttons.length,
    legitimate: results.filter(r => r.isLegitimate).length,
    suspicious: results.filter(r => !r.isLegitimate).length,
    timestamp: Date.now(),
  }).catch(() => {});
}

export async function init() {
  // Check settings before showing badges
  let showBadges = false;
  try {
    const settings = await sendMessage(MSG.GET_SETTINGS);
    showBadges = settings?.showTooltips === true;
  } catch {
    // Fallback: don't show badges if settings unavailable
  }

  const buttons = findDownloadButtons();
  const results = buttons.map(el => scoreDownloadButton(el));
  reportStats(buttons, results);

  if (showBadges) {
    addBadges();
  }
}

// Auto-init
init();
