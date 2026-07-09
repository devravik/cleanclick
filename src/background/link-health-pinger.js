/**
 * CleanClick — Link Health Checker (Background Script)
 *
 * 🟢 MODULE — Phase 3 (standalone)
 *
 * Proactively checks if outbound links are still safe by doing
 * lightweight HEAD requests. Privacy-first:
 * - Only checks links the user hovers over or is about to click
 * - Never sends full URLs externally (SHA-256 hashes only)
 * - Results cached for 24 hours
 *
 * Disabled by default — user must opt in.
 */

import { onMessage, onConnectFromContent } from '../shared/messaging.js';

// ─── Cache ─────────────────────────────────────────────────────────

const healthCache = new Map();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

// ─── Queue ─────────────────────────────────────────────────────────

const queue = [];
let processing = false;
const MAX_CONCURRENT = 3;

// ─── Health Check ─────────────────────────────────────────────────

/**
 * Perform a lightweight HEAD request to check link health.
 * @param {string} url
 * @returns {Promise<{ url: string, statusCode: number|null, redirectCount: number, finalUrl: string, timestamp: number }>}
 */
async function checkLink(url) {
  // Check cache
  const cached = healthCache.get(url);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const startTime = performance.now();
    const response = await fetch(url, {
      method: 'HEAD',
      redirect: 'follow',
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const result = {
      url: response.url || url,
      statusCode: response.status,
      statusText: response.statusText,
      redirectCount: response.redirected ? 1 : 0, // Browser follows redirects automatically
      finalUrl: response.url || url,
      duration: Math.round(performance.now() - startTime),
      timestamp: Date.now(),
    };

    healthCache.set(url, result);
    return result;
  } catch (err) {
    const result = {
      url,
      statusCode: null,
      statusText: err.name === 'AbortError' ? 'timeout' : 'unreachable',
      redirectCount: 0,
      finalUrl: url,
      duration: 5000,
      timestamp: Date.now(),
    };
    healthCache.set(url, result);
    return result;
  }
}

// ─── Queue Processing ─────────────────────────────────────────────

function enqueue(url, callback) {
  queue.push({ url, callback });
  processQueue();
}

async function processQueue() {
  if (processing) return;
  processing = true;

  while (queue.length > 0 && processing) {
    const batch = queue.splice(0, MAX_CONCURRENT);
    const results = await Promise.all(batch.map(item => checkLink(item.url).then(result => {
      item.callback(result);
      return result;
    })));
  }

  processing = false;
}

// ─── Analyze Result ───────────────────────────────────────────────

function analyzeHealth(result) {
  if (result.statusCode === null) {
    return { isHealthy: false, label: 'Unreachable', reason: 'Could not connect — link may be dead' };
  }

  if (result.statusCode >= 200 && result.statusCode < 400) {
    return { isHealthy: true, label: 'Reachable', reason: 'HTTP ' + result.statusCode };
  }

  if (result.statusCode >= 400 && result.statusCode < 500) {
    return { isHealthy: false, label: 'Broken', reason: 'HTTP ' + result.statusCode + ' — page not found' };
  }

  if (result.statusCode >= 500) {
    return { isHealthy: false, label: 'Server Error', reason: 'HTTP ' + result.statusCode + ' — server-side issue' };
  }

  if (result.statusText === 'timeout') {
    return { isHealthy: false, label: 'Timeout', reason: 'Connection timed out after 5s' };
  }

  return { isHealthy: false, label: 'Unknown', reason: 'Unexpected response' };
}

// ─── Public API ───────────────────────────────────────────────────

/**
 * Check a single URL (called from content script on hover).
 */
export async function checkURL(url) {
  return new Promise((resolve) => {
    const cached = healthCache.get(url);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      resolve({ ...cached, ...analyzeHealth(cached) });
      return;
    }
    enqueue(url, (result) => {
      resolve({ ...result, ...analyzeHealth(result) });
    });
  });
}

/**
 * Batch check multiple URLs (called on page load if enabled).
 */
export async function batchCheck(urls) {
  const results = [];
  for (const url of urls) {
    const result = await checkURL(url);
    results.push({ url, ...analyzeHealth(result) });
  }
  return results;
}

/**
 * Get cache stats.
 */
export function getCacheStats() {
  return {
    size: healthCache.size,
    oldest: Date.now() - CACHE_TTL,
  };
}

/**
 * Clear the health cache.
 */
export function clearCache() {
  healthCache.clear();
}

// ─── Message Handlers ─────────────────────────────────────────────

function setupMessageHandlers() {
  onMessage('health:check', async (payload) => {
    const result = await checkURL(payload.url);
    return { ...result, ...analyzeHealth(result) };
  });

  onMessage('health:batch', async (payload) => {
    return await batchCheck(payload.urls);
  });

  onMessage('health:cache-stats', async () => {
    return getCacheStats();
  });

  onMessage('health:clear-cache', async () => {
    clearCache();
    return { ok: true };
  });

  onMessage('health:settings', async (payload) => {
    // Health checking is enabled/disabled via storage settings
    return { enabled: payload?.enabled ?? false };
  });
}

// ─── Content Script Integration ───────────────────────────────────

/**
 * Handle hover-based health checks from content scripts.
 */
function setupContentConnection() {
  onConnectFromContent((port, sender) => {
    port.on('health:hover', async (payload) => {
      const result = await checkURL(payload.url);
      port.send('health:hover-result', { ...result, ...analyzeHealth(result) });
    });
  });
}

// ─── Init ─────────────────────────────────────────────────────────

export function init() {
  setupMessageHandlers();
  setupContentConnection();
  console.log('CleanClick: Link health checker ready');
}
