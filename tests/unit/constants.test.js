/**
 * Tests for constants.js
 */
import {
  TIMING, RISK, HIDDEN_LINK, HIJACK_EVENTS,
  SUSPICIOUS_DOMAINS, TRACKING_PARAMS, MSG, DEFAULT_SETTINGS,
} from '../../src/shared/constants.js';

describe('constants.js', () => {
  test('TIMING has all required thresholds', () => {
    expect(TIMING.CLICK_TO_NAV_MIN).toBe(100);
    expect(TIMING.CLICK_TO_NAV_MAX).toBe(30_000);
    expect(TIMING.RAPID_REDIRECT_HOPS).toBe(3);
    expect(TIMING.RAPID_REDIRECT_WINDOW).toBe(2_000);
    expect(TIMING.OBSERVER_DEBOUNCE_MS).toBe(500);
  });

  test('RISK thresholds are in correct range', () => {
    expect(RISK.SAFE_MAX).toBeLessThan(RISK.SUSPICIOUS_MAX);
    expect(RISK.SUSPICIOUS_MAX).toBeLessThan(100);
    expect(RISK.DEFAULT_SCORE).toBe(0);
  });

  test('HIDDEN_LINK thresholds are defined', () => {
    expect(HIDDEN_LINK.OPACITY_THRESHOLD).toBeLessThan(0.1);
    expect(HIDDEN_LINK.SIZE_THRESHOLD).toBe(2);
    expect(HIDDEN_LINK.OVERLAY_COVERAGE_MIN).toBeGreaterThan(0.5);
    expect(HIDDEN_LINK.OVERLAY_ZINDEX_MIN).toBeGreaterThan(500);
  });

  test('HIJACK_EVENTS contains all required event types', () => {
    expect(HIJACK_EVENTS).toContain('click');
    expect(HIJACK_EVENTS).toContain('mousedown');
    expect(HIJACK_EVENTS).toContain('mouseup');
    expect(HIJACK_EVENTS).toContain('auxclick');
    expect(HIJACK_EVENTS).toContain('touchstart');
    expect(HIJACK_EVENTS).toContain('touchend');
  });

  test('SUSPICIOUS_DOMAINS has entries', () => {
    expect(SUSPICIOUS_DOMAINS.length).toBeGreaterThan(20);
    expect(SUSPICIOUS_DOMAINS).toContain('bit.ly');
    expect(SUSPICIOUS_DOMAINS).toContain('.xyz');
  });

  test('TRACKING_PARAMS contains common tracking parameters', () => {
    expect(TRACKING_PARAMS).toContain('utm_source');
    expect(TRACKING_PARAMS).toContain('fbclid');
    expect(TRACKING_PARAMS).toContain('gclid');
    expect(TRACKING_PARAMS.length).toBeGreaterThan(10);
  });

  test('MSG has all required message types', () => {
    expect(MSG.CLICK_RECORDED).toBe('click:recorded');
    expect(MSG.EVENT_FLAG).toBe('event:flag');
    expect(MSG.HIDDEN_LINKS_FOUND).toBe('hidden-links:found');
    expect(MSG.POPUP_BLOCKED).toBe('popup:blocked');
    expect(MSG.GET_STATS).toBe('get:stats');
    expect(MSG.TOGGLE_PROTECTION).toBe('toggle:protection');
  });

  test('DEFAULT_SETTINGS has all required keys', () => {
    expect(DEFAULT_SETTINGS.protectionEnabled).toBe(true);
    expect(DEFAULT_SETTINGS.showRiskBadges).toBe(false);
    expect(DEFAULT_SETTINGS.showTooltips).toBe(false);
    expect(DEFAULT_SETTINGS.confirmLevel).toBe('suspicious');
    expect(DEFAULT_SETTINGS.autoRevealHidden).toBe(false);
    expect(DEFAULT_SETTINGS.sanitizeLinks).toBe(true);
    expect(DEFAULT_SETTINGS.healthCheckEnabled).toBe(false);
    expect(DEFAULT_SETTINGS.densityWarningEnabled).toBe(false);
    expect(DEFAULT_SETTINGS.theme).toBe('auto');
    expect(DEFAULT_SETTINGS.language).toBe('auto');
  });
});
