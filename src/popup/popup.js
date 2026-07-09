/**
 * CleanClick — Popup Controller
 *
 * Main controller for the browser action popup.
 * Communicates with the background script to fetch
 * protection status, statistics, and link scan results.
 */

import {
  sendMessage, getStats, getProtectionStatus, getLinkScan,
  requestRevealHidden,
} from '../shared/messaging.js';
import { MSG } from '../shared/constants.js';

// ─── State ─────────────────────────────────────────────────────────

const state = {
  tabId: null,
  protection: null,
  stats: null,
  scanResults: null,
};

// ─── DOM References ───────────────────────────────────────────────

const $ = (id) => document.getElementById(id);

// ─── Initialization ───────────────────────────────────────────────

async function init() {
  // Get current tab
  const tabs = await browser.tabs.query({ active: true, currentWindow: true });
  if (!tabs[0]) return;
  state.tabId = tabs[0].id;

  // Load all data in parallel
  const [protection, stats, scanResults] = await Promise.all([
    getProtectionStatus(state.tabId),
    getStats(),
    getLinkScan(state.tabId),
  ]);

  state.protection = protection;
  state.stats = stats;
  state.scanResults = scanResults;

  render();
}

// ─── Render ───────────────────────────────────────────────────────

function render() {
  renderStatusBar();
  renderProtectionToggle();
  renderStats();
  renderLinkScanSummary();
}

function renderStatusBar() {
  const bar = $('status-bar');
  if (!bar) return;

  const { enabled, domain } = state.protection;
  const hasIssues = state.scanResults && (
    state.scanResults.hasHidden || state.scanResults.hasHijacked || state.scanResults.hasScam
  );

  bar.innerHTML = `
    <div class="status ${enabled ? 'active' : 'disabled'}">
      <span class="status-dot"></span>
      <span class="status-text">${enabled ? 'Protection Active' : 'Protection Off'}</span>
    </div>
    ${domain ? `<span class="domain">${domain}</span>` : ''}
    ${hasIssues ? '<span class="warning-badge">Issues found</span>' : ''}
  `;
}

function renderProtectionToggle() {
  const container = $('protection-toggle');
  if (!container) return;

  const { enabled, isWhitelisted } = state.protection;

  container.innerHTML = `
    <label class="toggle">
      <input type="checkbox" ${enabled ? 'checked' : ''} id="protect-toggle">
      <span class="toggle-slider"></span>
    </label>
    <span class="toggle-label">${enabled ? 'Enabled for this site' : 'Disabled for this site'}</span>
    ${isWhitelisted ? '<span class="badge badge-whitelisted">Whitelisted</span>' : ''}
  `;

  $('protect-toggle')?.addEventListener('change', toggleProtection);
}

function renderStats() {
  const container = $('stats-panel');
  if (!container || !state.stats) return;

  const { redirectsBlocked, popupsPrevented, suspiciousDomainsDetected, hiddenLinksFound } = state.stats;

  container.innerHTML = `
    <div class="stats-list">
      <div class="stat-item">
        <span class="stat-label">Redirects Blocked</span>
        <span class="stat-value">${redirectsBlocked || 0}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">Popups Prevented</span>
        <span class="stat-value">${popupsPrevented || 0}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">Suspicious Domains</span>
        <span class="stat-value">${suspiciousDomainsDetected || 0}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">Hidden Links</span>
        <span class="stat-value">${hiddenLinksFound || 0}</span>
      </div>
    </div>
  `;
}

function renderLinkScanSummary() {
  const container = $('link-scan-summary');
  if (!container || !state.scanResults) return;

  const { stats, hasHidden, hasHijacked, hasScam } = state.scanResults;
  const totalIssues = (stats?.hiddenCount || 0) + (stats?.hijackedCount || 0) + (stats?.scamCount || 0);

  if (totalIssues === 0) {
    container.innerHTML = `
      <div class="scan-summary safe">
        <span class="scan-icon">[OK]</span>
        <span>No issues detected on this page</span>
      </div>
    `;
    return;
  }

  let html = '<div class="scan-summary warning">';
  html += `<span class="scan-icon">!</span>`;
  html += `<span>${totalIssues} issue${totalIssues > 1 ? 's' : ''} found</span>`;
  html += '</div>';
  html += '<ul class="scan-details">';

  if (hasHidden) {
    html += `<li><span>${stats.hiddenCount} hidden link${stats.hiddenCount > 1 ? 's' : ''}</span>`;
    html += `<button class="btn-link" id="reveal-btn">Reveal</button></li>`;
  }
  if (hasHijacked) {
    html += `<li><span>${stats.hijackedCount} hijacked element${stats.hijackedCount > 1 ? 's' : ''}</span></li>`;
  }
  if (hasScam) {
    html += `<li><span>${stats.scamCount} scam overlay${stats.scamCount > 1 ? 's' : ''}</span></li>`;
  }

  html += '</ul>';
  container.innerHTML = html;

  $('reveal-btn')?.addEventListener('click', () => {
    requestRevealHidden(state.tabId);
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

// ─── Settings Link ────────────────────────────────────────────────

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
