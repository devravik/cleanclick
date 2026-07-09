/**
 * CleanClick — Storage Abstraction Layer
 *
 * Wraps browser.storage.local + browser.storage.sync with:
 * - Schema versioning & auto-migration
 * - Default values
 * - Change listeners
 * - Cross-context sync helpers
 */

import { STORAGE_KEYS, DEFAULT_SETTINGS } from './constants.js';

const SCHEMA_VERSION_KEY = 'schemaVersion';
const CURRENT_SCHEMA_VERSION = 1;

/**
 * Storage wrapper with defaults and migration.
 * All methods return Promises.
 */
class Storage {
  constructor() {
    this._cache = null;
    this._listeners = new Map();
  }

  // ─── Initialization & Migration ──────────────────────────────────

  /** Call once on extension startup */
  async init() {
    const version = (await this._getRaw(SCHEMA_VERSION_KEY)) || 0;
    if (version < CURRENT_SCHEMA_VERSION) {
      await this._migrate(version);
      await this._setRaw(SCHEMA_VERSION_KEY, CURRENT_SCHEMA_VERSION);
    }
    await this._populateDefaults();
  }

  async _migrate(fromVersion) {
    // Future migration steps go here
    if (fromVersion < 1) {
      // v0 → v1: initial schema, nothing to migrate
    }
  }

  async _populateDefaults() {
    const existing = await this._getRaw(STORAGE_KEYS.SETTINGS);
    if (!existing) {
      await this._setRaw(STORAGE_KEYS.SETTINGS, { ...DEFAULT_SETTINGS });
    }
    // Ensure stats key exists
    const stats = await this._getRaw(STORAGE_KEYS.STATISTICS);
    if (!stats) {
      await this._setRaw(STORAGE_KEYS.STATISTICS, this._emptyStats());
    }
  }

  _emptyStats() {
    return {
      redirectsBlocked: 0,
      popupsPrevented: 0,
      suspiciousDomainsDetected: 0,
      hiddenLinksFound: 0,
      hijackedElementsFlagged: 0,
      sessionsProtected: 0,
      daily: [],
    };
  }

  // ─── Core Get/Set ────────────────────────────────────────────────

  /** Get a value, falling back to default if not set */
  async get(key, defaultValue = null) {
    const value = await this._getRaw(key);
    return value !== undefined ? value : defaultValue;
  }

  /** Set a value */
  async set(key, value) {
    await this._setRaw(key, value);
    this._notify(key, value);
  }

  /** Remove a key */
  async remove(key) {
    await browser.storage.local.remove(key);
    this._notify(key, undefined);
  }

  /** Get all keys matching a prefix (e.g., 'statistics:*') */
  async getByPrefix(prefix) {
    const all = await browser.storage.local.get(null);
    const result = {};
    for (const [key, value] of Object.entries(all)) {
      if (key.startsWith(prefix)) result[key] = value;
    }
    return result;
  }

  // ─── Settings Helpers ────────────────────────────────────────────

  async getSettings() {
    return (await this.get(STORAGE_KEYS.SETTINGS, { ...DEFAULT_SETTINGS }));
  }

  async updateSettings(partial) {
    const current = await this.getSettings();
    const merged = { ...current, ...partial };
    await this.set(STORAGE_KEYS.SETTINGS, merged);
    return merged;
  }

  // ─── Whitelist Helpers ──────────────────────────────────────────

  async getWhitelist() {
    return (await this.get(STORAGE_KEYS.WHITELIST, []));
  }

  async addToWhitelist(domain) {
    const list = await this.getWhitelist();
    if (!list.includes(domain)) {
      list.push(domain);
      await this.set(STORAGE_KEYS.WHITELIST, list);
    }
    return list;
  }

  async removeFromWhitelist(domain) {
    const list = await this.getWhitelist();
    const filtered = list.filter(d => d !== domain);
    await this.set(STORAGE_KEYS.WHITELIST, filtered);
    return filtered;
  }

  async isWhitelisted(url) {
    const list = await this.getWhitelist();
    try {
      const { hostname } = new URL(url);
      return list.some(pattern => {
        if (pattern.startsWith('*.')) {
          return hostname.endsWith(pattern.slice(1));
        }
        return hostname === pattern || hostname.endsWith('.' + pattern);
      });
    } catch {
      return false;
    }
  }

  // ─── Statistics ──────────────────────────────────────────────────

  async getStats() {
    const stats = await this.get(STORAGE_KEYS.STATISTICS, this._emptyStats());
    // Ensure all keys exist (schema may have been extended)
    const defaults = this._emptyStats();
    for (const [k, v] of Object.entries(defaults)) {
      if (!(k in stats)) stats[k] = v;
    }
    return stats;
  }

  async incrementStat(key, amount = 1) {
    const stats = await this.getStats();
    stats[key] = (stats[key] || 0) + amount;
    // Maintain daily rollup
    const today = new Date().toISOString().slice(0, 10);
    let dailyEntry = stats.daily.find(d => d.date === today);
    if (!dailyEntry) {
      dailyEntry = { date: today, redirectsBlocked: 0, popupsPrevented: 0,
        suspiciousDomainsDetected: 0, hiddenLinksFound: 0, hijackedElementsFlagged: 0 };
      stats.daily.push(dailyEntry);
      // Keep only 90 days
      if (stats.daily.length > 90) stats.daily = stats.daily.slice(-90);
    }
    dailyEntry[key] = (dailyEntry[key] || 0) + amount;
    await this.set(STORAGE_KEYS.STATISTICS, stats);
    return stats;
  }

  async resetStats() {
    await this.set(STORAGE_KEYS.STATISTICS, this._emptyStats());
  }

  // ─── Change Listeners ────────────────────────────────────────────

  onChanged(key, callback) {
    if (!this._listeners.has(key)) this._listeners.set(key, new Set());
    this._listeners.get(key).add(callback);
    // Return unsubscribe function
    return () => this._listeners.get(key)?.delete(callback);
  }

  _notify(key, value) {
    const cbs = this._listeners.get(key);
    if (cbs) cbs.forEach(cb => cb(value));
  }

  // ─── Raw Browser API Access ─────────────────────────────────────

  async _getRaw(key) {
    const result = await browser.storage.local.get(key);
    return result[key];
  }

  async _setRaw(key, value) {
    await browser.storage.local.set({ [key]: value });
  }
}

// Singleton
export const storage = new Storage();
export default storage;
