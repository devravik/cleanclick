/**
 * CleanClick - Link Transparency UI (Content Script)
 *
 * Visual feedback for links:
 * A. Risk badges (colored dots) - controlled by showRiskBadges setting
 * B. Custom hover tooltip - controlled by showTooltips setting
 * C. Click confirmation dialogs
 *
 * Runs at document_idle.
 */

import { MSG } from '../shared/constants.js';
import { sendMessage } from '../shared/messaging.js';

// ─── State ─────────────────────────────────────────────────────────

const state = {
  tooltipEl: null,
  settings: { showRiskBadges: false, showTooltips: false },
};

// ─── A. Risk Badge Overlay ─────────────────────────────────────────

/**
 * Load settings and apply badges/tooltips accordingly.
 */
async function loadSettings() {
  try {
    const s = await sendMessage(MSG.GET_SETTINGS);
    if (s) state.settings = s;
  } catch { }
}

function addRiskBadges() {
  if (!state.settings.showRiskBadges) return;

  const links = document.querySelectorAll('a[href]');

  // Inject badge styles once
  if (!document.getElementById('cleanclick-badge-styles')) {
    const style = document.createElement('style');
    style.id = 'cleanclick-badge-styles';
    style.textContent = `
      .cleanclick-badge { position:absolute; top:-2px; right:-2px; width:8px; height:8px;
        border-radius:50%; border:1px solid white; box-shadow:0 1px 2px rgba(0,0,0,0.3);
        z-index:2147483646; pointer-events:none; }
      .cleanclick-badge.safe { background:#2e7d32; }
      .cleanclick-badge.suspicious { background:#f57c00; }
      .cleanclick-badge.dangerous { background:#d32f2f; }
      .cleanclick-badge.unknown { background:#9e9e9e; }
    `;
    document.head.appendChild(style);
  }

  for (const link of links) {
    const href = link.href || '';
    if (!href || href.startsWith('javascript:')) continue;

    const riskLevel = assessQuickRisk(href);
    const container = link;
    if (window.getComputedStyle(link).position === 'static') {
      link.style.position = 'relative';
    }

    const badge = document.createElement('span');
    badge.className = 'cleanclick-badge ' + riskLevel;
    badge.setAttribute('aria-label', 'Link risk: ' + riskLevel);
    badge.dataset.href = href;
    container.appendChild(badge);
  }
}

function assessQuickRisk(url) {
  try {
    const u = new URL(url);
    if (u.protocol === 'javascript:' || u.protocol === 'data:') return 'dangerous';
    const suspiciousTLDs = ['.tk', '.ml', '.ga', '.cf', '.gq', '.xyz', '.top', '.work', '.click', '.download', '.review', '.trade', '.bid', '.date', '.webcam', '.men', '.loan', '.win', '.mom', '.party'];
    for (const tld of suspiciousTLDs) { if (u.hostname.endsWith(tld)) return 'suspicious'; }
    const shorteners = ['bit.ly', 'tinyurl.com', 'ow.ly', 'is.gd', 't.co', 'goo.gl', 'rebrand.ly', 'shorturl.at', 'cutt.ly', 'rb.gy'];
    for (const s of shorteners) { if (u.hostname.includes(s)) return 'suspicious'; }
    return 'safe';
  } catch { return 'unknown'; }
}

// ─── B. Custom Tooltip Component ──────────────────────────────────

function createTooltip() {
  if (!state.settings.showTooltips) return;
  if (state.tooltipEl) return;

  const el = document.createElement('div');
  el.id = 'cleanclick-tooltip';
  el.style.cssText = 'display:none;position:fixed;z-index:2147483647;background:#1a1a2e;color:#eee;' +
    'border-radius:8px;padding:12px 16px;font-family:-apple-system,system-ui,sans-serif;' +
    'font-size:12px;line-height:1.5;max-width:400px;box-shadow:0 4px 16px rgba(0,0,0,0.4);' +
    'pointer-events:none;border:1px solid rgba(255,255,255,0.1);';
  el.innerHTML = '<div id="cleanclick-tooltip-content"></div>';
  document.body.appendChild(el);
  state.tooltipEl = el;
}

function showTooltip(e, link) {
  if (!state.settings.showTooltips) return;
  if (!state.tooltipEl) createTooltip();
  if (!state.tooltipEl) return;

  const tooltip = state.tooltipEl;
  const content = document.getElementById('cleanclick-tooltip-content');

  const href = link.href || '';
  const text = (link.textContent || '').trim().slice(0, 80);
  const riskLevel = assessQuickRisk(href);

  const riskColors = { safe: '#2e7d32', suspicious: '#f57c00', dangerous: '#d32f2f', unknown: '#9e9e9e' };
  const riskLabels = { safe: 'Safe', suspicious: 'Suspicious', dangerous: 'Dangerous', unknown: 'Unknown' };

  content.innerHTML =
    '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">' +
    '<span style="width:10px;height:10px;border-radius:50%;background:' + (riskColors[riskLevel] || '#9e9e9e') + '"></span>' +
    '<strong style="font-size:13px">' + (riskLabels[riskLevel] || 'Unknown') + '</strong>' +
    '</div>' +
    '<div style="font-size:11px;color:#aaa;word-break:break-all;margin-bottom:4px">' +
    '<span style="color:#666">Destination: </span>' + escapeHtml(href) +
    '</div>' +
    (text ? '<div style="font-size:11px;color:#aaa"><span style="color:#666">Text: </span>' + escapeHtml(text) + '</div>' : '') +
    '<div style="font-size:10px;color:#888;margin-top:4px;font-style:italic">Click for details</div>';

  const padding = 12;
  let left = e.clientX + 12;
  let top = e.clientY + 12;
  const tw = 400;
  const th = 200;
  if (left + tw > window.innerWidth) left = e.clientX - tw - 12;
  if (top + th > window.innerHeight) top = window.innerHeight - th - 12;
  if (left < 0) left = 12;
  if (top < 0) top = 12;

  tooltip.style.left = left + 'px';
  tooltip.style.top = top + 'px';
  tooltip.style.display = 'block';
}

function hideTooltip() {
  if (state.tooltipEl) state.tooltipEl.style.display = 'none';
}

// ─── Tooltip Event Listeners ─────────────────────────────────────

document.addEventListener('mouseover', (e) => {
  if (!state.settings.showTooltips) return;
  const link = e.target.closest('a[href]');
  if (link) showTooltip(e, link);
}, true);

document.addEventListener('mouseout', (e) => {
  if (!state.settings.showTooltips) return;
  const link = e.target.closest('a[href]');
  if (!link) hideTooltip();
}, true);

// ─── C. Click Confirmation Dialogs ───────────────────────────────

document.addEventListener('click', async (e) => {
  const link = e.target.closest('a[href]');
  if (!link) return;

  const href = link.href || '';
  const riskLevel = assessQuickRisk(href);

  if (riskLevel === 'safe') return;
  if (riskLevel === 'suspicious') {
    e.preventDefault();
    const allowed = await showConfirmationBar(href);
    if (allowed) window.location.href = href;
    return;
  }
  if (riskLevel === 'dangerous' || riskLevel === 'unknown') {
    e.preventDefault();
    const allowed = await showConfirmationModal(href);
    if (allowed) window.location.href = href;
    return;
  }
}, true);

function showConfirmationBar(url) {
  const existing = document.getElementById('cleanclick-confirm-bar');
  if (existing) existing.remove();

  const bar = document.createElement('div');
  bar.id = 'cleanclick-confirm-bar';
  bar.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:2147483647;' +
    'background:#fff3cd;color:#856404;padding:10px 16px;font-family:-apple-system,system-ui,sans-serif;' +
    'font-size:13px;display:flex;align-items:center;gap:12px;box-shadow:0 2px 8px rgba(0,0,0,0.15);';
  bar.innerHTML =
    '<span style="font-size:16px">!</span>' +
    '<span style="flex:1">Suspicious link: <code style="font-size:11px;word-break:break-all">' + escapeHtml(url) + '</code></span>' +
    '<button id="cleanclick-confirm-yes" style="padding:6px 12px;background:#856404;color:white;border:none;border-radius:4px;cursor:pointer">Continue</button>' +
    '<button id="cleanclick-confirm-no" style="padding:6px 12px;background:transparent;color:#856404;border:1px solid #856404;border-radius:4px;cursor:pointer">Cancel</button>';

  document.body.prepend(bar);
  return new Promise((resolve) => {
    document.getElementById('cleanclick-confirm-yes').onclick = () => { bar.remove(); resolve(true); };
    document.getElementById('cleanclick-confirm-no').onclick = () => { bar.remove(); resolve(false); };
    setTimeout(() => { if (document.getElementById('cleanclick-confirm-bar')) { bar.remove(); resolve(false); } }, 5000);
  });
}

function showConfirmationModal(url) {
  const existing = document.getElementById('cleanclick-confirm-modal');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'cleanclick-confirm-modal';
  overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;z-index:2147483647;' +
    'background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;';
  overlay.innerHTML = '<div style="background:#fff;border-radius:12px;padding:24px;max-width:420px;width:90%;' +
    'box-shadow:0 8px 32px rgba(0,0,0,0.3);font-family:-apple-system,system-ui,sans-serif">' +
    '<h3 style="margin:0 0 8px;font-size:18px;color:#d32f2f">Dangerous Link</h3>' +
    '<p style="margin:0 0 4px;font-size:13px;color:#5b5b66;word-break:break-all"><code>' + escapeHtml(url) + '</code></p>' +
    '<p style="margin:0 0 16px;font-size:13px;color:#5b5b66">This link was flagged as potentially dangerous. Proceed with caution.</p>' +
    '<div style="display:flex;gap:8px;justify-content:flex-end">' +
    '<button id="cleanclick-modal-no" style="padding:10px 20px;background:#f5f5f7;border:1px solid #cfcfd8;border-radius:6px;cursor:pointer;font-size:13px">Go back (safe)</button>' +
    '<button id="cleanclick-modal-yes" style="padding:10px 20px;background:#d32f2f;color:white;border:none;border-radius:6px;cursor:pointer;font-size:13px;font-weight:600">Proceed anyway</button>' +
    '</div></div>';
  document.body.appendChild(overlay);
  return new Promise((resolve) => {
    document.getElementById('cleanclick-modal-no').onclick = () => { overlay.remove(); resolve(false); };
    document.getElementById('cleanclick-modal-yes').onclick = () => { overlay.remove(); resolve(true); };
  });
}

// ─── Utility ──────────────────────────────────────────────────────

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ─── Init ─────────────────────────────────────────────────────────

async function init() {
  await loadSettings();
  createTooltip();
  addRiskBadges();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => init());
} else {
  init();
}
