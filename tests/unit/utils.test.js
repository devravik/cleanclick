/**
 * Tests for utils.js
 */
import {
  parseURL, normalizeURL, getDomainParts, isSameDomain,
  detectHomograph, detectInvisibleChars, detectBidiOverrides,
  levenshteinDistance, debounce, throttle,
  stripTrackingParams, extractDomain, checkProtocol,
} from '../../src/shared/utils.js';
import { TRACKING_PARAMS } from '../../src/shared/constants.js';

describe('parseURL', () => {
  test('parses a standard URL', () => {
    const result = parseURL('https://example.com/path?q=1#section');
    expect(result.protocol).toBe('https');
    expect(result.hostname).toBe('example.com');
    expect(result.pathname).toBe('/path');
    expect(result.search).toBe('?q=1');
    expect(result.hash).toBe('#section');
  });

  test('returns null for invalid URL', () => {
    expect(parseURL('not-a-url')).toBeNull();
    expect(parseURL('')).toBeNull();
  });

  test('handles URLs with ports', () => {
    const result = parseURL('http://localhost:8080/');
    expect(result.port).toBe('8080');
    expect(result.hostname).toBe('localhost');
  });
});

describe('normalizeURL', () => {
  test('normalizes case and removes trailing slash', () => {
    const result = normalizeURL('HTTPS://EXAMPLE.COM/PATH/');
    expect(result).toBe('https://example.com/path');
  });

  test('removes fragment', () => {
    const result = normalizeURL('https://example.com/page#section');
    expect(result).toBe('https://example.com/page');
  });

  test('preserves query string', () => {
    const result = normalizeURL('https://example.com/?a=1&b=2');
    expect(result).toBe('https://example.com/?a=1&b=2');
  });
});

describe('getDomainParts', () => {
  test('splits simple domain', () => {
    const parts = getDomainParts('example.com');
    expect(parts.domain).toBe('example');
    expect(parts.tld).toBe('com');
    expect(parts.subdomain).toBe('');
  });

  test('splits domain with subdomain', () => {
    const parts = getDomainParts('sub.example.com');
    expect(parts.domain).toBe('example');
    expect(parts.subdomain).toBe('sub');
  });

  test('handles multi-level subdomains', () => {
    const parts = getDomainParts('a.b.c.example.com');
    expect(parts.domain).toBe('example');
    expect(parts.subdomain).toBe('a.b.c');
  });
});

describe('isSameDomain', () => {
  test('returns true for same domain with www', () => {
    expect(isSameDomain('https://example.com', 'https://www.example.com')).toBe(true);
  });

  test('returns false for different domains', () => {
    expect(isSameDomain('https://example.com', 'https://evil.com')).toBe(false);
  });

  test('returns true for same domain with different paths', () => {
    expect(isSameDomain('https://example.com/page1', 'https://example.com/page2')).toBe(true);
  });
});

describe('detectHomograph', () => {
  test('detects Latin/Greek mixed characters', () => {
    // 'g' 'o' 'o' 'g' 'l' 'e' . 'c' 'o' 'm' with Greek omicron
    const result = detectHomograph('gοοgle.com');
    expect(result.isHomograph).toBe(true);
    expect(result.confusablesFound.length).toBeGreaterThan(0);
  });

  test('returns false for clean ASCII domain', () => {
    const result = detectHomograph('example.com');
    expect(result.isHomograph).toBe(false);
    expect(result.confusablesFound.length).toBe(0);
  });

  test('normalizes confusable characters', () => {
    const result = detectHomograph('gοοgle.com');
    expect(result.normalized).toBe('google.com');
  });
});

describe('levenshteinDistance', () => {
  test('returns 0 for identical strings', () => {
    expect(levenshteinDistance('google.com', 'google.com')).toBe(0);
  });

  test('returns 1 for single char difference', () => {
    expect(levenshteinDistance('google.com', 'googl.com')).toBe(1);
  });

  test('handles empty strings', () => {
    expect(levenshteinDistance('', 'abc')).toBe(3);
    expect(levenshteinDistance('abc', '')).toBe(3);
  });
});

describe('detectInvisibleChars', () => {
  test('detects zero-width characters', () => {
    const result = detectInvisibleChars('ex\u200Bample.com');
    expect(result.found).toBe(true);
    expect(result.chars.length).toBe(1);
    expect(result.chars[0].codePoint).toBe(0x200B);
  });

  test('returns no false positives for clean text', () => {
    const result = detectInvisibleChars('example.com');
    expect(result.found).toBe(false);
  });
});

describe('detectBidiOverrides', () => {
  test('detects RTL override characters', () => {
    const result = detectBidiOverrides('ex\u202Eample.com');
    expect(result.found).toBe(true);
    expect(result.positions).toContain(2);
  });
});

describe('stripTrackingParams', () => {
  test('strips known tracking parameters', () => {
    const url = 'https://example.com/?utm_source=twitter&fbclid=123&q=real';
    const cleaned = stripTrackingParams(url, TRACKING_PARAMS);
    expect(cleaned).not.toContain('utm_source');
    expect(cleaned).not.toContain('fbclid');
    expect(cleaned).toContain('q=real');
  });

  test('returns original URL if no tracking params', () => {
    const url = 'https://example.com/?q=real';
    expect(stripTrackingParams(url, TRACKING_PARAMS)).toBe(url);
  });
});

describe('checkProtocol', () => {
  test('identifies non-standard protocols', () => {
    expect(checkProtocol('javascript:void(0)').isNonStandard).toBe(true);
    expect(checkProtocol('data:text/html,hi').isNonStandard).toBe(true);
    expect(checkProtocol('blob:1234').isNonStandard).toBe(true);
  });

  test('http/https are standard', () => {
    expect(checkProtocol('https://example.com').isNonStandard).toBe(false);
    expect(checkProtocol('http://example.com').isNonStandard).toBe(false);
  });
});

describe('debounce', () => {
  jest.useFakeTimers();

  test('debounces function calls', () => {
    const fn = jest.fn();
    const debounced = debounce(fn, 100);

    debounced();
    debounced();
    debounced();

    expect(fn).not.toHaveBeenCalled();

    jest.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  test('cancel works', () => {
    const fn = jest.fn();
    const debounced = debounce(fn, 100);

    debounced();
    debounced.cancel();
    jest.advanceTimersByTime(100);

    expect(fn).not.toHaveBeenCalled();
  });
});

describe('throttle', () => {
  jest.useFakeTimers();

  test('throttles function calls', () => {
    const fn = jest.fn();
    const throttled = throttle(fn, 100);

    throttled();
    throttled();
    throttled();

    expect(fn).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
