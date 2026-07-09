/**
 * CleanClick — Statistics (Background Script)
 *
 * Tracks all protection metrics:
 * - Redirects blocked
 * - Popups prevented
 * - Suspicious domains detected
 * - Hidden links found
 * - Hijacked elements flagged
 * - Sessions protected
 *
 * Stores with daily rollups for 90-day history.
 */

import { MSG } from '../shared/constants.js';
import { onMessage } from '../shared/messaging.js';
import storage from '../shared/storage.js';

export function init() {
  // Increment session counter on startup
  storage.incrementStat('sessionsProtected').catch(() => {});

  // Handle stats requests from popup
  onMessage(MSG.GET_STATS, async () => {
    return await storage.getStats();
  });

  onMessage('stats:reset', async () => {
    await storage.resetStats();
    return { ok: true };
  });
}
