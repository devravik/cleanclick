/**
 * Tests for storage.js (uses browser mock)
 */
import storage from '../../src/shared/storage.js';

describe('storage.js', () => {
  beforeEach(async () => {
    // Clear all mock storage
    browser.storage.local.clear();
    browser.storage.sync.clear();
    // Re-init storage
    await storage.init();
  });

  describe('get / set / remove', () => {
    test('set and get a value', async () => {
      await storage.set('testKey', { hello: 'world' });
      const value = await storage.get('testKey');
      expect(value).toEqual({ hello: 'world' });
    });

    test('returns default when key not found', async () => {
      const value = await storage.get('nonexistent', 'default');
      expect(value).toBe('default');
    });

    test('remove deletes a key', async () => {
      await storage.set('temp', 'value');
      await storage.remove('temp');
      const value = await storage.get('temp', 'gone');
      expect(value).toBe('gone');
    });
  });

  describe('settings', () => {
    test('getSettings returns defaults on first call', async () => {
      const settings = await storage.getSettings();
      expect(settings.protectionEnabled).toBe(true);
      expect(settings.showRiskBadges).toBe(false);
      expect(settings.confirmLevel).toBe('suspicious');
      expect(settings.theme).toBe('auto');
    });

    test('updateSettings merges with existing', async () => {
      const updated = await storage.updateSettings({ showRiskBadges: false });
      expect(updated.showRiskBadges).toBe(false);
      expect(updated.protectionEnabled).toBe(true); // unchanged
    });
  });

  describe('whitelist', () => {
    test('addToWhitelist and isWhitelisted', async () => {
      await storage.addToWhitelist('example.com');
      const result = await storage.isWhitelisted('https://example.com/page');
      expect(result).toBe(true);
    });

    test('removeFromWhitelist', async () => {
      await storage.addToWhitelist('example.com');
      await storage.removeFromWhitelist('example.com');
      const result = await storage.isWhitelisted('https://example.com/page');
      expect(result).toBe(false);
    });

    test('getWhitelist returns array', async () => {
      await storage.addToWhitelist('a.com');
      await storage.addToWhitelist('b.com');
      const list = await storage.getWhitelist();
      expect(list).toContain('a.com');
      expect(list).toContain('b.com');
    });

    test('wildcard pattern matching', async () => {
      await storage.addToWhitelist('*.example.com');
      expect(await storage.isWhitelisted('https://sub.example.com')).toBe(true);
      expect(await storage.isWhitelisted('https://other.com')).toBe(false);
    });
  });

  describe('statistics', () => {
    test('getStats returns zeroed counters', async () => {
      const stats = await storage.getStats();
      expect(stats.redirectsBlocked).toBe(0);
      expect(stats.popupsPrevented).toBe(0);
    });

    test('incrementStat increases counter', async () => {
      await storage.incrementStat('redirectsBlocked');
      await storage.incrementStat('redirectsBlocked');
      const stats = await storage.getStats();
      expect(stats.redirectsBlocked).toBe(2);
    });

    test('resetStats clears all counters', async () => {
      await storage.incrementStat('redirectsBlocked', 5);
      await storage.resetStats();
      const stats = await storage.getStats();
      expect(stats.redirectsBlocked).toBe(0);
    });

    test('daily rollup creates entry for today', async () => {
      const today = new Date().toISOString().slice(0, 10);
      await storage.incrementStat('redirectsBlocked');
      const stats = await storage.getStats();
      const dailyEntry = stats.daily.find(d => d.date === today);
      expect(dailyEntry).toBeDefined();
      expect(dailyEntry.redirectsBlocked).toBe(1);
    });
  });

  describe('change listeners', () => {
    test('onChanged fires when value changes', (done) => {
      storage.onChanged('testKey', (value) => {
        expect(value).toBe('newValue');
        done();
      });
      storage.set('testKey', 'newValue');
    });
  });
});
