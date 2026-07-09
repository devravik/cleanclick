/**
 * CleanClick — Whitelist Manager (Background Script)
 *
 * Manages the user's website whitelist.
 * Provides CRUD operations and fast lookup.
 * Integrates with redirect-detector and hidden-link-scanner.
 */

import { MSG } from '../shared/constants.js';
import { onMessage } from '../shared/messaging.js';
import storage from '../shared/storage.js';

export function init() {
  // Handle whitelist queries from popup
  onMessage('whitelist:get', async () => {
    return await storage.getWhitelist();
  });

  onMessage('whitelist:add', async (payload) => {
    const { domain } = payload;
    if (!domain || typeof domain !== 'string') return { error: 'Invalid domain' };
    const cleaned = domain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    await storage.addToWhitelist(cleaned);
    return { ok: true, domain: cleaned };
  });

  onMessage('whitelist:remove', async (payload) => {
    const { domain } = payload;
    await storage.removeFromWhitelist(domain);
    return { ok: true };
  });

  onMessage('whitelist:check', async (payload) => {
    const { url } = payload;
    const isWhitelisted = await storage.isWhitelisted(url);
    return { isWhitelisted };
  });

  onMessage('whitelist:export', async () => {
    const list = await storage.getWhitelist();
    return { data: JSON.stringify(list, null, 2), filename: 'cleanclick-whitelist.json' };
  });

  onMessage('whitelist:import', async (payload) => {
    try {
      const domains = JSON.parse(payload.data);
      if (!Array.isArray(domains)) return { error: 'Invalid format: expected array' };
      for (const domain of domains) {
        await storage.addToWhitelist(String(domain).trim().toLowerCase());
      }
      return { ok: true, count: domains.length };
    } catch (err) {
      return { error: `Parse error: ${err.message}` };
    }
  });
}
