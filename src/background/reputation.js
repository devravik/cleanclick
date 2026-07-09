/**
 * CleanClick - Redirect Reputation Scoring (Background Script)
 *
 * Local IndexedDB database of domain reputations.
 * Scoring: 0 (trusted) → 100 (malicious).
 */

import { RISK } from '../shared/constants.js';
import { onMessage } from '../shared/messaging.js';

const DB_NAME = 'cleanclick-reputation';
const DB_VERSION = 1;
const STORE_NAME = 'reputation';
let db = null;

async function openDB() {
  if (db) return db;
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const d = e.target.result;
      if (!d.objectStoreNames.contains(STORE_NAME)) {
        const s = d.createObjectStore(STORE_NAME, { keyPath: 'domain' });
        s.createIndex('score', 'score', { unique: false });
      }
    };
    req.onsuccess = (e) => { db = e.target.result; resolve(db); };
    req.onerror = (e) => reject(e.target.error);
  });
}

async function getEntry(domain) {
  try {
    const d = await openDB();
    return new Promise((r) => {
      const tx = d.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(domain);
      req.onsuccess = () => r(req.result || null);
      req.onerror = () => r(null);
    });
  } catch { return null; }
}

async function putEntry(entry) {
  try {
    const d = await openDB();
    return new Promise((resolve, reject) => {
      const tx = d.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(entry);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch { }
}

export async function updateReputation(domain, hopCount, patterns = []) {
  const entry = (await getEntry(domain)) || {
    domain, score: RISK.DEFAULT_SCORE, redirectCount: 0,
    userUpvotes: 0, userDownvotes: 0, knownPatterns: [],
    lastSeen: Date.now(), createdAt: Date.now(),
  };
  entry.redirectCount++;
  entry.lastSeen = Date.now();
  for (const p of patterns) {
    if (!entry.knownPatterns.includes(p)) entry.knownPatterns.push(p);
  }

  let score = RISK.DEFAULT_SCORE;
  if (hopCount > 1) score += (hopCount - 1) * RISK.PER_REDIRECT_PENALTY;
  const malicious = ['adserver->tracker->malware', 'popunder->ad->redirect', 'shortener->tracker->malware'];
  if (entry.knownPatterns.some((p) => malicious.some((m) => p.includes(m)))) score += RISK.MALICIOUS_PATTERN_PENALTY;
  if (entry.userDownvotes > entry.userUpvotes) score += Math.min(30, (entry.userDownvotes - entry.userUpvotes) * 10);
  else if (entry.userUpvotes > entry.userDownvotes) score -= Math.min(30, (entry.userUpvotes - entry.userDownvotes) * 10);
  entry.score = Math.max(0, Math.min(100, score));

  await putEntry(entry);
  return entry;
}

export async function recordUserFeedback(domain, feedback) {
  const entry = (await getEntry(domain)) || {
    domain, score: RISK.DEFAULT_SCORE, redirectCount: 0,
    userUpvotes: 0, userDownvotes: 0, knownPatterns: [],
    lastSeen: Date.now(), createdAt: Date.now(),
  };
  if (feedback === 'safe') { entry.userUpvotes++; entry.score = Math.max(0, entry.score - 10); }
  else if (feedback === 'malicious') { entry.userDownvotes++; entry.score = Math.min(100, entry.score + 20); }
  await putEntry(entry);
  return entry;
}

export async function classifyDomain(domain) {
  const entry = await getEntry(domain);
  if (!entry) return 'green';
  if (entry.score <= RISK.SAFE_MAX) return 'green';
  if (entry.score <= RISK.SUSPICIOUS_MAX) return 'yellow';
  return 'red';
}

function setupMessageHandlers() {
  onMessage('reputation:classify', async (p) => {
    const c = await classifyDomain(p.domain);
    const e = await getEntry(p.domain);
    return { classification: c, score: e?.score || RISK.DEFAULT_SCORE };
  });
  onMessage('reputation:feedback', async (p) => {
    const e = await recordUserFeedback(p.domain, p.feedback);
    return { score: e.score, classification: e.score <= RISK.SAFE_MAX ? 'Trusted' : e.score <= RISK.SUSPICIOUS_MAX ? 'Suspicious' : 'Malicious' };
  });
  onMessage('reputation:stats', async () => {
    try {
      const d = await openDB();
      const req = d.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).count();
      return new Promise((r) => { req.onsuccess = () => r({ totalEntries: req.result }); req.onerror = () => r({ totalEntries: 0 }); });
    } catch { return { totalEntries: 0 }; }
  });
}

export function init() {
  setupMessageHandlers();
  openDB().then(() => console.log('CleanClick: Reputation DB ready')).catch(() => { });
}
