/**
 * CleanClick - Options Page Controller
 *
 * Full settings page with tabs:
 * - General: link preview, appearance, navigation
 * - Whitelist: add/remove domains, import/export
 * - Statistics: view and reset
 * - Custom Rules: regex/glob patterns
 * - About: version, privacy, license
 */

import { sendMessage } from '../shared/messaging.js';
import { DEFAULT_SETTINGS, STORAGE_KEYS, MSG } from '../shared/constants.js';
import { t, applyLanguage } from '../shared/i18n.js';

// ─── State ─────────────────────────────────────────────────────────

const state = {
  settings: { ...DEFAULT_SETTINGS },
  whitelist: [],
  stats: null,
  currentTab: 'general',
};

// ─── DOM Helpers ──────────────────────────────────────────────────

const $ = (id) => document.getElementById(id);

// ─── Init ─────────────────────────────────────────────────────────

async function init() {
  await loadData();
  setupTabs();
  renderGeneral();
  renderWhitelist();
  renderStatistics();
  renderAbout();
  applyTheme(state.settings.theme);
  applyLanguage(state.settings.language);
}

async function loadData() {
  try {
    const storage = await browser.storage.local.get([
      STORAGE_KEYS.SETTINGS,
      STORAGE_KEYS.WHITELIST,
      STORAGE_KEYS.STATISTICS,
    ]);
    state.settings = { ...DEFAULT_SETTINGS, ...(storage[STORAGE_KEYS.SETTINGS] || {}) };
    state.whitelist = storage[STORAGE_KEYS.WHITELIST] || [];
    state.stats = storage[STORAGE_KEYS.STATISTICS] || {};
  } catch (err) {
    console.error('Failed to load settings:', err);
  }
}

// ─── Tab Navigation ───────────────────────────────────────────────

function setupTabs() {
  document.querySelectorAll('[data-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      switchTab(tab);
    });
  });
  // Localize tab buttons
  const tabLabels = {
    'general': 'tabGeneral',
    'whitelist': 'tabWhitelist',
    'statistics': 'tabStatistics',
    'rules': 'tabCustomRules',
    'about': 'tabAbout',
  };
  document.querySelectorAll('[data-tab]').forEach(btn => {
    const key = tabLabels[btn.dataset.tab];
    if (key) btn.textContent = t(key);
  });
}

function switchTab(tab) {
  state.currentTab = tab;
  document.querySelectorAll('[data-tab]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });
  document.querySelectorAll('section[id^="tab-"]').forEach(section => {
    section.hidden = section.id !== 'tab-' + tab;
  });
}

// ─── General Tab ──────────────────────────────────────────────────

function renderGeneral() {
  const container = $('tab-general');
  if (!container) return;

  container.innerHTML = '' +
    '<h2>' + t('generalSettings') + '</h2>' +

    '<div class="setting-group">' +
      '<h3>' + t('linkPreview') + '</h3>' +

      '<label class="setting-row">' +
        '<span>' + t('showRiskBadges') + '</span>' +
        '<input type="checkbox" id="setting-badges"' +
          (state.settings.showRiskBadges ? ' checked' : '') + '>' +
      '</label>' +

      '<label class="setting-row">' +
        '<span>' + t('enableHoverTooltips') + '</span>' +
        '<input type="checkbox" id="setting-tooltips"' +
          (state.settings.showTooltips ? ' checked' : '') + '>' +
      '</label>' +

      '<label class="setting-row">' +
        '<span>' + t('autoRevealHiddenLinks') + '</span>' +
        '<input type="checkbox" id="setting-autoreveal"' +
          (state.settings.autoRevealHidden ? ' checked' : '') + '>' +
      '</label>' +
    '</div>' +

    '<div class="setting-group">' +
      '<h3>' + t('appearance') + '</h3>' +

      '<label class="setting-row">' +
        '<span>' + t('theme') + '</span>' +
        '<select id="setting-theme">' +
          '<option value="auto"' + (state.settings.theme === 'auto' ? ' selected' : '') + '>' + t('themeAuto') + '</option>' +
          '<option value="light"' + (state.settings.theme === 'light' ? ' selected' : '') + '>' + t('themeLight') + '</option>' +
          '<option value="dark"' + (state.settings.theme === 'dark' ? ' selected' : '') + '>' + t('themeDark') + '</option>' +
        '</select>' +
      '</label>' +

      '<label class="setting-row">' +
        '<span>' + t('language') + '</span>' +
        '<select id="setting-language">' +
          '<option value="auto"' + (state.settings.language === 'auto' ? ' selected' : '') + '>' + t('languageAuto') + '</option>' +
          '<option value="hi"' + (state.settings.language === 'hi' ? ' selected' : '') + '>Hindi</option>' +
          '<option value="en"' + (state.settings.language === 'en' ? ' selected' : '') + '>English</option>' +
          '<option value="es"' + (state.settings.language === 'es' ? ' selected' : '') + '>Español</option>' +
          '<option value="fr"' + (state.settings.language === 'fr' ? ' selected' : '') + '>Français</option>' +
          '<option value="de"' + (state.settings.language === 'de' ? ' selected' : '') + '>Deutsch</option>' +
          '<option value="zh_CN"' + (state.settings.language === 'zh_CN' ? ' selected' : '') + '>中文</option>' +
          '<option value="ar"' + (state.settings.language === 'ar' ? ' selected' : '') + '>العربية</option>' +
          '<option value="pt_BR"' + (state.settings.language === 'pt_BR' ? ' selected' : '') + '>Português (BR)</option>' +
          '<option value="ru"' + (state.settings.language === 'ru' ? ' selected' : '') + '>Русский</option>' +
          '<option value="ja"' + (state.settings.language === 'ja' ? ' selected' : '') + '>日本語</option>' +
          '<option value="ko"' + (state.settings.language === 'ko' ? ' selected' : '') + '>한국어</option>' +
        '</select>' +
      '</label>' +
    '</div>' +

    '<div class="setting-group">' +
      '<h3>' + t('navigation') + '</h3>' +

      '<label class="setting-row">' +
        '<span>' + t('clickConfirmationLevel') + '</span>' +
        '<select id="setting-confirm">' +
          '<option value="never"' + (state.settings.confirmLevel === 'never' ? ' selected' : '') + '>' + t('confirmNever') + '</option>' +
          '<option value="suspicious"' + (state.settings.confirmLevel === 'suspicious' ? ' selected' : '') + '>' + t('confirmSuspicious') + '</option>' +
          '<option value="all"' + (state.settings.confirmLevel === 'all' ? ' selected' : '') + '>' + t('confirmAll') + '</option>' +
        '</select>' +
      '</label>' +

      '<label class="setting-row">' +
        '<span>' + t('sanitizeLinks') + '</span>' +
        '<input type="checkbox" id="setting-sanitize"' +
          (state.settings.sanitizeLinks ? ' checked' : '') + '>' +
      '</label>' +

      '<label class="setting-row">' +
        '<span>' + t('showLinkDensityWarning') + '</span>' +
        '<input type="checkbox" id="setting-densityWarning"' +
          (state.settings.densityWarningEnabled ? ' checked' : '') + '>' +
      '</label>' +
    '</div>';

  // Bind change events
  container.querySelectorAll('input[type="checkbox"], select').forEach(el => {
    el.addEventListener('change', onSettingChange);
  });
}

async function onSettingChange(e) {
  const id = e.target.id;
  const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;

  const key = id.replace('setting-', '');
  state.settings[key] = value;

  await browser.storage.local.set({ [STORAGE_KEYS.SETTINGS]: state.settings });

  if (key === 'theme') applyTheme(value);
  if (key === 'language') applyLanguage(value);
}

// ─── Whitelist Tab ────────────────────────────────────────────────

function renderWhitelist() {
  const container = $('tab-whitelist');
  if (!container) return;

  const listHtml = state.whitelist.map(d =>
    '<li class="whitelist-item">' +
      '<span class="whitelist-domain">' + escapeHtml(d) + '</span>' +
      '<button class="btn-icon whitelist-remove" data-domain="' + escapeHtml(d) + '" title="' + t('remove') + '">x</button>' +
    '</li>'
  ).join('');

  container.innerHTML = '' +
    '<h2>' + t('websiteWhitelist') + '</h2>' +
    '<p class="description">' + t('whitelistDescription') + '</p>' +

    '<div class="whitelist-add">' +
      '<input type="text" id="whitelist-input" placeholder="' + t('whitelistPlaceholder') + '" class="input">' +
      '<button id="whitelist-add-btn" class="btn primary">' + t('add') + '</button>' +
    '</div>' +

    '<div class="whitelist-actions">' +
      '<button id="whitelist-export" class="btn secondary">' + t('exportJson') + '</button>' +
      '<button id="whitelist-import" class="btn secondary">' + t('importJson') + '</button>' +
    '</div>' +

    (state.whitelist.length === 0
      ? '<p class="empty-state">' + t('noWhitelistedDomains') + '</p>'
      : '<ul class="whitelist-list">' + listHtml + '</ul>'
    ) +

    '<input type="file" id="whitelist-file-input" accept=".json" style="display:none">';

  // Bind events
  $('whitelist-add-btn').addEventListener('click', addWhitelistDomain);
  $('whitelist-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') addWhitelistDomain();
  });
  $('whitelist-export').addEventListener('click', exportWhitelist);
  $('whitelist-import').addEventListener('click', () => $('whitelist-file-input').click());
  $('whitelist-file-input').addEventListener('change', importWhitelist);

  container.querySelectorAll('.whitelist-remove').forEach(btn => {
    btn.addEventListener('click', () => removeWhitelistDomain(btn.dataset.domain));
  });
}

async function addWhitelistDomain() {
  const input = $('whitelist-input');
  const domain = input.value.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  if (!domain) return;

  const result = await sendMessage('whitelist:add', { domain });
  if (result.ok) {
    state.whitelist.push(domain);
    renderWhitelist();
    input.value = '';
  }
}

async function removeWhitelistDomain(domain) {
  await sendMessage('whitelist:remove', { domain });
  state.whitelist = state.whitelist.filter(d => d !== domain);
  renderWhitelist();
}

async function exportWhitelist() {
  const result = await sendMessage('whitelist:export');
  const blob = new Blob([result.data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = result.filename;
  a.click();
  URL.revokeObjectURL(url);
}

async function importWhitelist(e) {
  const file = e.target.files[0];
  if (!file) return;
  const text = await file.text();
  const result = await sendMessage('whitelist:import', { data: text });
  if (result.ok) {
    await loadData();
    renderWhitelist();
  } else {
    alert('Import failed: ' + result.error);
  }
  e.target.value = '';
}

// ─── Statistics Tab ───────────────────────────────────────────────

function renderStatistics() {
  const container = $('tab-statistics');
  if (!container) return;

  const s = state.stats || {};
  container.innerHTML = '' +
    '<h2>' + t('statistics') + '</h2>' +

    '<div class="stats-table">' +
      '<div class="stats-row">' +
        '<span>' + t('redirectsBlocked') + '</span>' +
        '<span class="stats-val">' + (s.redirectsBlocked || 0) + '</span>' +
      '</div>' +
      '<div class="stats-row">' +
        '<span>' + t('popupsPrevented') + '</span>' +
        '<span class="stats-val">' + (s.popupsPrevented || 0) + '</span>' +
      '</div>' +
      '<div class="stats-row">' +
        '<span>' + t('suspiciousDomains') + '</span>' +
        '<span class="stats-val">' + (s.suspiciousDomainsDetected || 0) + '</span>' +
      '</div>' +
      '<div class="stats-row">' +
        '<span>' + t('hiddenLinks') + '</span>' +
        '<span class="stats-val">' + (s.hiddenLinksFound || 0) + '</span>' +
      '</div>' +
      '<div class="stats-row">' +
        '<span>' + t('hijackedElementsFlagged') + '</span>' +
        '<span class="stats-val">' + (s.hijackedElementsFlagged || 0) + '</span>' +
      '</div>' +
      '<div class="stats-row">' +
        '<span>' + t('sessionsProtected') + '</span>' +
        '<span class="stats-val">' + (s.sessionsProtected || 0) + '</span>' +
      '</div>' +
    '</div>' +

    '<button id="reset-stats-btn" class="btn danger">' + t('resetAllStatistics') + '</button>';

  $('reset-stats-btn').addEventListener('click', async () => {
    if (confirm(t('resetConfirm'))) {
      await sendMessage('stats:reset', {});
      state.stats = {};
      renderStatistics();
    }
  });
}

// ─── About Tab ────────────────────────────────────────────────────

function renderAbout() {
  const container = $('tab-about');
  if (!container) return;

  container.innerHTML = '' +
    '<h2>' + t('extensionName') + '</h2>' +
    '<p class="version">' + t('version', '0.1.0') + '</p>' +
    '<p class="description">' + t('extensionDescription') + '</p>' +

    '<h3>' + t('privacy') + '</h3>' +
    '<p>' + t('privacyText') + '</p>' +

    '<h3>' + t('license') + '</h3>' +
    '<p>' + t('licenseText', '<a href="https://github.com/devravik/cleanclick/blob/main/LICENSE" target="_blank">LICENSE</a>') + '</p>' +

    '<h3>' + t('links') + '</h3>' +
    '<ul class="links">' +
      '<li><a href="https://github.com/devravik/cleanclick" target="_blank">' + t('githubRepository') + '</a></li>' +
      '<li><a href="https://github.com/devravik/cleanclick/issues" target="_blank">' + t('reportIssue') + '</a></li>' +
    '</ul>';
}

// ─── Utilities ────────────────────────────────────────────────────

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ─── Theme ──────────────────────────────────────────────────────────

function applyTheme(theme) {
  if (theme === 'auto') {
    document.documentElement.removeAttribute('data-theme');
  } else {
    document.documentElement.setAttribute('data-theme', theme);
  }
}

// ─── Init ─────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', init);
