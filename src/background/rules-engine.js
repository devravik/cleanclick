/**
 * CleanClick - Custom Blocking Rules (Background Script)
 *
 * User-defined rules engine: if URL matches pattern → action.
 * Supports glob, regex, or exact domain patterns.
 *
 * Actions: block, warn, allow.
 */

import { STORAGE_KEYS } from '../shared/constants.js';

const RULES_KEY = STORAGE_KEYS.CUSTOM_RULES;

/**
 * @typedef {Object} Rule
 * @property {string} id - Unique identifier
 * @property {string} name - Human-readable name
 * @property {string} pattern - Glob, regex, or domain pattern
 * @property {'glob'|'regex'|'domain'} patternType - Type of pattern
 * @property {'block'|'warn'|'allow'} action - What to do on match
 * @property {boolean} enabled - Whether the rule is active
 * @property {number} createdAt - Timestamp
 * @property {number} hitCount - How many times this rule matched
 */

// ─── Rule Matching ────────────────────────────────────────────────

/**
 * Test a URL against a single rule.
 * @param {string} url
 * @param {Rule} rule
 * @returns {boolean}
 */
function matchRule(url, rule) {
  if (!rule.enabled) return false;

  switch (rule.patternType) {
    case 'domain':
      return matchDomain(url, rule.pattern);
    case 'glob':
      return matchGlob(url, rule.pattern);
    case 'regex':
      return matchRegex(url, rule.pattern);
    default:
      return false;
  }
}

function matchDomain(url, pattern) {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    const p = pattern.toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    if (p.startsWith('*.')) {
      return hostname.endsWith(p.slice(1)) || hostname === p.slice(2);
    }
    return hostname === p || hostname.endsWith('.' + p);
  } catch {
    return false;
  }
}

function matchGlob(url, pattern) {
  // Convert glob to regex
  const regexStr = '^' + pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.') + '$';
  try {
    return new RegExp(regexStr, 'i').test(url);
  } catch {
    return false;
  }
}

function matchRegex(url, pattern) {
  try {
    return new RegExp(pattern, 'i').test(url);
  } catch {
    return false;
  }
}

// ─── Storage ──────────────────────────────────────────────────────

async function getRules() {
  const result = await browser.storage.local.get(RULES_KEY);
  return result[RULES_KEY] || [];
}

async function saveRules(rules) {
  await browser.storage.local.set({ [RULES_KEY]: rules });
}

// ─── Public API ───────────────────────────────────────────────────

export async function addRule(rule) {
  const rules = await getRules();
  rule.id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  rule.createdAt = Date.now();
  rule.hitCount = 0;
  rules.push(rule);
  await saveRules(rules);
  return rule;
}

export async function updateRule(id, updates) {
  const rules = await getRules();
  const idx = rules.findIndex((r) => r.id === id);
  if (idx === -1) return null;
  rules[idx] = { ...rules[idx], ...updates };
  await saveRules(rules);
  return rules[idx];
}

export async function removeRule(id) {
  const rules = await getRules();
  const filtered = rules.filter((r) => r.id !== id);
  await saveRules(filtered);
  return filtered;
}

export async function getRule(id) {
  const rules = await getRules();
  return rules.find((r) => r.id === id) || null;
}

export async function getAllRules() {
  return await getRules();
}

/**
 * Test a URL against all enabled rules.
 * Returns the first matching rule's action, or null if no match.
 * @param {string} url
 * @returns {Promise<{ action: string, rule: Rule }|null>}
 */
export async function matchURL(url) {
  const rules = await getRules();
  // Sort by specificity: regex > glob > domain
  const sorted = [...rules.filter((r) => r.enabled)];
  sorted.sort((a, b) => {
    const order = { regex: 0, glob: 1, domain: 2 };
    return (order[a.patternType] || 0) - (order[b.patternType] || 0);
  });

  for (const rule of sorted) {
    if (matchRule(url, rule)) {
      // Increment hit count
      rule.hitCount = (rule.hitCount || 0) + 1;
      await updateRule(rule.id, { hitCount: rule.hitCount });
      return { action: rule.action, rule };
    }
  }
  return null;
}

export async function clearAllRules() {
  await saveRules([]);
}

export async function importRules(rules) {
  if (!Array.isArray(rules)) throw new Error('Rules must be an array');
  const current = await getRules();
  const merged = [...current];
  for (const r of rules) {
    r.id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    r.createdAt = Date.now();
    r.hitCount = 0;
    merged.push(r);
  }
  await saveRules(merged);
  return merged;
}

// ─── Message Handlers ─────────────────────────────────────────────

import { onMessage } from '../shared/messaging.js';

function setupMessageHandlers() {
  onMessage('rules:list', async () => ({ rules: await getAllRules() }));
  onMessage('rules:add', async (p) => ({ rule: await addRule(p.rule) }));
  onMessage('rules:update', async (p) => ({ rule: await updateRule(p.id, p.updates) }));
  onMessage('rules:remove', async (p) => ({ rules: await removeRule(p.id) }));
  onMessage('rules:match', async (p) => ({ result: await matchURL(p.url) }));
  onMessage('rules:clear', async () => { await clearAllRules(); return { ok: true }; });
  onMessage('rules:import', async (p) => {
    try { const r = await importRules(p.rules); return { rules: r }; }
    catch (e) { return { error: e.message }; }
  });
  onMessage('rules:export', async () => ({ rules: await getAllRules() }));
}

export function init() {
  setupMessageHandlers();
}
