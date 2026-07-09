/**
 * CleanClick — Options Page Controller
 *
 * Full settings page with tabs:
 * - General: link preview settings, protection defaults
 * - Whitelist: add/remove domains, import/export
 * - Statistics: view and reset
 * - Custom Rules: placeholder for v1.5
 * - About: version, licenses
 */

import { sendMessage } from '../shared/messaging.js';
import { DEFAULT_SETTINGS, STORAGE_KEYS, MSG } from '../shared/constants.js';

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
}

function switchTab(tab) {
  state.currentTab = tab;

  // Update button states
  document.querySelectorAll('[data-tab]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });

  // Update section visibility
  document.querySelectorAll('section[id^="tab-"]').forEach(section => {
    section.hidden = section.id !== `tab-${tab}`;
  });
}

// ─── General Tab ──────────────────────────────────────────────────

function renderGeneral() {
  const container = $('tab-general');
  if (!container) return;

  container.innerHTML = `
    <h2>General Settings</h2>

    <div class="setting-group">
      <h3>Link Preview</h3>

      <label class="setting-row">
        <span>Show risk badges on links</span>
        <input type="checkbox" id="setting-badges"
          ${state.settings.showRiskBadges ? 'checked' : ''}>
      </label>

      <label class="setting-row">
        <span>Enable hover tooltips</span>
        <input type="checkbox" id="setting-tooltips"
          ${state.settings.showTooltips ? 'checked' : ''}>
      </label>

      <label class="setting-row">
        <span>Auto-reveal hidden links</span>
        <input type="checkbox" id="setting-autoreveal"
          ${state.settings.autoRevealHidden ? 'checked' : ''}>
      </label>
    </div>

    <div class="setting-group">
      <h3>Navigation</h3>

      <label class="setting-row">
        <span>Click confirmation level</span>
        <select id="setting-confirm">
          <option value="never" ${state.settings.confirmLevel === 'never' ? 'selected' : ''}>Never</option>
          <option value="suspicious" ${state.settings.confirmLevel === 'suspicious' ? 'selected' : ''}>Suspicious only</option>
          <option value="all" ${state.settings.confirmLevel === 'all' ? 'selected' : ''}>All external links</option>
        </select>
      </label>

      <label class="setting-row">
        <span>Sanitize links (remove tracking)</span>
        <input type="checkbox" id="setting-sanitize"
          ${state.settings.sanitizeLinks ? 'checked' : ''}>
      </label>
    </div>

  `;

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
}

// ─── Whitelist Tab ────────────────────────────────────────────────

function renderWhitelist() {
  const container = $('tab-whitelist');
  if (!container) return;

  const listHtml = state.whitelist.map(d => `
    <li class="whitelist-item">
      <span class="whitelist-domain">${escapeHtml(d)}</span>
      <button class="btn-icon whitelist-remove" data-domain="${escapeHtml(d)}" title="Remove">✕</button>
    </li>
  `).join('');

  container.innerHTML = `
    <h2>Website Whitelist</h2>
    <p class="description">Protected sites where CleanClick will not block redirects or flag links.</p>

    <div class="whitelist-add">
      <input type="text" id="whitelist-input" placeholder="example.com" class="input">
      <button id="whitelist-add-btn" class="btn primary">Add</button>
    </div>

    <div class="whitelist-actions">
      <button id="whitelist-export" class="btn secondary">Export JSON</button>
      <button id="whitelist-import" class="btn secondary">Import JSON</button>
    </div>

    ${state.whitelist.length === 0
      ? '<p class="empty-state">No whitelisted domains yet.</p>'
      : `<ul class="whitelist-list">${listHtml}</ul>`
    }

    <input type="file" id="whitelist-file-input" accept=".json" style="display:none">
  `;

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
    alert(`Import failed: ${result.error}`);
  }
  e.target.value = '';
}

// ─── Statistics Tab ───────────────────────────────────────────────

function renderStatistics() {
  const container = $('tab-statistics');
  if (!container) return;

  const s = state.stats || {};
  container.innerHTML = `
    <h2>Statistics</h2>

    <div class="stats-table">
      <div class="stats-row">
        <span>Redirects Blocked</span>
        <span class="stats-val">${s.redirectsBlocked || 0}</span>
      </div>
      <div class="stats-row">
        <span>Popups Prevented</span>
        <span class="stats-val">${s.popupsPrevented || 0}</span>
      </div>
      <div class="stats-row">
        <span>Suspicious Domains Detected</span>
        <span class="stats-val">${s.suspiciousDomainsDetected || 0}</span>
      </div>
      <div class="stats-row">
        <span>Hidden Links Found</span>
        <span class="stats-val">${s.hiddenLinksFound || 0}</span>
      </div>
      <div class="stats-row">
        <span>Hijacked Elements Flagged</span>
        <span class="stats-val">${s.hijackedElementsFlagged || 0}</span>
      </div>
      <div class="stats-row">
        <span>Sessions Protected</span>
        <span class="stats-val">${s.sessionsProtected || 0}</span>
      </div>
    </div>

    <button id="reset-stats-btn" class="btn danger">Reset All Statistics</button>
  `;

  $('reset-stats-btn').addEventListener('click', async () => {
    if (confirm('Are you sure? This will permanently delete all statistics.')) {
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

  container.innerHTML = `
    <h2>CleanClick</h2>
    <p class="version">Version 0.1.0</p>
    <p class="description">Protects you from unwanted redirects, pop-under ads, fake download buttons, and malicious navigation tricks.</p>

    <h3>Privacy</h3>

    <h3>License</h3>
    <p>MIT License — see <a href="https://github.com/devravik/cleanclick/blob/main/LICENSE" target="_blank">LICENSE</a> for details.</p>

    <h3>Links</h3>
    <ul class="links">
      <li><a href="https://github.com/devravik/cleanclick" target="_blank">GitHub Repository</a></li>
      <li><a href="https://github.com/devravik/cleanclick/issues" target="_blank">Report Issue</a></li>
    </ul>
  `;
}

// ─── Utilities ────────────────────────────────────────────────────

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ─── Init ─────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', init);
