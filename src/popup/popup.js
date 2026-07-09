/**
 * CleanClick - Popup Controller
 *
 * Main controller for the browser action popup.
 * Communicates with the background script to fetch
 * protection status, statistics, and link scan results.
 */

import {
  sendMessage, getStats, getProtectionStatus, getLinkScan,
  requestRevealHidden, getSettings,
} from '../shared/messaging.js';
import { MSG } from '../shared/constants.js';
import { t, initI18n } from '../shared/i18n.js';

// ─── State ─────────────────────────────────────────────────────────

const state = {
  tabId: null,
  protection: null,
  stats: null,
  scanResults: null,
  settings: null,
};

// ─── DOM References ───────────────────────────────────────────────

const $ = (id) => document.getElementById(id);

// ─── Initialization ───────────────────────────────────────────────

async function init() {
  const tabs = await browser.tabs.query({ active: true, currentWindow: true });
  if (!tabs[0]) return;
  state.tabId = tabs[0].id;

  const [protection, stats, scanResults, settings] = await Promise.all([
    getProtectionStatus(state.tabId),
    getStats(),
    getLinkScan(state.tabId),
    getSettings(),
  ]);

  state.protection = protection;
  state.stats = stats;
  state.scanResults = scanResults;
  state.settings = settings;

  applyTheme(settings?.theme);

  // Initialize translations
  await initI18n(settings?.language);

  render();
}

// ─── Render ───────────────────────────────────────────────────────

function render() {
  renderStatusBar();
  renderProtectionToggle();
  renderStats();
  renderLinkScanSummary();
  renderLanguageSelector();
}

function renderStatusBar() {
  const bar = $('status-bar');
  if (!bar) return;

  const { enabled, domain } = state.protection;
  const hasIssues = state.scanResults && (
    state.scanResults.hasHidden || state.scanResults.hasHijacked || state.scanResults.hasScam
  );

  bar.innerHTML =
    '<div class="status ' + (enabled ? 'active' : 'disabled') + '">' +
      '<span class="status-dot"></span>' +
      '<span class="status-text">' + (enabled ? t('protectionActive') : t('protectionOff')) + '</span>' +
    '</div>' +
    (domain ? '<span class="domain">' + domain + '</span>' : '') +
    (hasIssues ? '<span class="warning-badge">' + t('issuesFound') + '</span>' : '');
}

function renderProtectionToggle() {
  const container = $('protection-toggle');
  if (!container) return;

  const { enabled, isWhitelisted } = state.protection;

  container.innerHTML =
    '<label class="toggle">' +
      '<input type="checkbox" ' + (enabled ? 'checked' : '') + ' id="protect-toggle">' +
      '<span class="toggle-slider"></span>' +
    '</label>' +
    '<span class="toggle-label">' + (enabled ? t('enabledForThisSite') : t('disabledForThisSite')) + '</span>' +
    (isWhitelisted ? '<span class="badge badge-whitelisted">' + t('whitelisted') + '</span>' : '');

  $('protect-toggle')?.addEventListener('change', toggleProtection);
}

function renderStats() {
  const container = $('stats-panel');
  if (!container || !state.stats) return;

  const { redirectsBlocked, popupsPrevented, suspiciousDomainsDetected, hiddenLinksFound } = state.stats;

  container.innerHTML =
    '<div class="stats-list">' +
      '<div class="stat-item">' +
        '<span class="stat-label">' + t('redirectsBlocked') + '</span>' +
        '<span class="stat-value">' + (redirectsBlocked || 0) + '</span>' +
      '</div>' +
      '<div class="stat-item">' +
        '<span class="stat-label">' + t('popupsPrevented') + '</span>' +
        '<span class="stat-value">' + (popupsPrevented || 0) + '</span>' +
      '</div>' +
      '<div class="stat-item">' +
        '<span class="stat-label">' + t('suspiciousDomains') + '</span>' +
        '<span class="stat-value">' + (suspiciousDomainsDetected || 0) + '</span>' +
      '</div>' +
      '<div class="stat-item">' +
        '<span class="stat-label">' + t('hiddenLinks') + '</span>' +
        '<span class="stat-value">' + (hiddenLinksFound || 0) + '</span>' +
      '</div>' +
    '</div>';
}

function renderLinkScanSummary() {
  const container = $('link-scan-summary');
  if (!container || !state.scanResults) return;

  const { stats, hasHidden, hasHijacked, hasScam } = state.scanResults;
  const totalIssues = (stats?.hiddenCount || 0) + (stats?.hijackedCount || 0) + (stats?.scamCount || 0);

  if (totalIssues === 0) {
    container.innerHTML =
      '<div class="scan-summary safe">' +
        '<span class="scan-icon">[OK]</span>' +
        '<span>' + t('noIssuesDetected') + '</span>' +
      '</div>';
    return;
  }

  let html = '<div class="scan-summary warning">';
  html += '<span class="scan-icon">!</span>';
  html += '<span>' + (totalIssues === 1 ? t('issueFound', totalIssues) : t('issuesFound_plural', totalIssues)) + '</span>';
  html += '</div>';
  html += '<ul class="scan-details">';

  if (hasHidden) {
    html += '<li><span>' + (stats.hiddenCount === 1 ? t('hiddenLink', stats.hiddenCount) : t('hiddenLink_plural', stats.hiddenCount)) + '</span>';
    html += '<button class="btn-link" id="reveal-btn">' + t('reveal') + '</button></li>';
  }
  if (hasHijacked) {
    html += '<li><span>' + (stats.hijackedCount === 1 ? t('hijackedElement', stats.hijackedCount) : t('hijackedElement_plural', stats.hijackedCount)) + '</span></li>';
  }
  if (hasScam) {
    html += '<li><span>' + (stats.scamCount === 1 ? t('scamOverlay', stats.scamCount) : t('scamOverlay_plural', stats.scamCount)) + '</span></li>';
  }

  html += '</ul>';
  container.innerHTML = html;

  $('reveal-btn')?.addEventListener('click', () => {
    requestRevealHidden(state.tabId);
  });
}

// ─── Language Selector in Popup ───────────────────────────────────

function renderLanguageSelector() {
  const container = $('language-selector');
  if (!container) return;

  const current = state.settings?.language || 'auto';
  const langLabels = {
    'auto': 'Auto', 'en': 'EN', 'hi': 'HI', 'es': 'ES', 'fr': 'FR',
    'de': 'DE', 'zh_CN': '中文', 'ar': 'العربية', 'pt_BR': 'PT',
    'ru': 'RU', 'ja': '日本語', 'ko': '한국어',
  };

  container.innerHTML =
    '<select id="popup-lang-select" style="font-size:11px;padding:2px 6px;border:1px solid var(--card-border);border-radius:4px;background:var(--card-bg);color:var(--text-secondary);font-family:var(--font);cursor:pointer;max-width:100px">' +
    Object.entries(langLabels).map(([code, label]) =>
      '<option value="' + code + '"' + (current === code ? ' selected' : '') + '>' + label + '</option>'
    ).join('') +
    '</select>';

  $('popup-lang-select')?.addEventListener('change', async (e) => {
    const newLang = e.target.value;
    state.settings.language = newLang;
    await initI18n(newLang);
    // Save to storage
    await sendMessage('settings:update', { key: 'language', value: newLang });
    // Re-render with new language
    render();
  });
}

// ─── Event Handlers ───────────────────────────────────────────────

async function toggleProtection(e) {
  const result = await sendMessage(MSG.TOGGLE_PROTECTION, { tabId: state.tabId });
  if (result.nowWhitelisted) {
    state.protection.enabled = false;
    state.protection.isWhitelisted = true;
  } else {
    state.protection.enabled = true;
    state.protection.isWhitelisted = false;
  }
  renderStatusBar();
  renderProtectionToggle();
}

// ─── Footer Links ─────────────────────────────────────────────────

$('settings-link')?.addEventListener('click', (e) => {
  e.preventDefault();
  browser.runtime.openOptionsPage();
});

// ─── Theme ──────────────────────────────────────────────────────────

function applyTheme(theme) {
  if (!theme || theme === 'auto') {
    document.documentElement.removeAttribute('data-theme');
  } else {
    document.documentElement.setAttribute('data-theme', theme);
  }
}

// ─── Init ─────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', init);
