/**
 * Tests for link-classifier.js
 */
import { classifyURL, classifyLinkElement, classifyURLs } from '../../src/shared/link-classifier.js';

describe('classifyURL', () => {
  test('returns safe for normal URL', () => {
    const result = classifyURL('https://example.com');
    expect(result.riskLevel).toBe('safe');
    expect(result.riskScore).toBeLessThanOrEqual(20);
  });

  test('flags javascript: protocol as dangerous', () => {
    const result = classifyURL('javascript:window.location="https://evil.com"');
    expect(result.riskLevel).toBe('dangerous');
    expect(result.riskScore).toBeGreaterThan(50);
    expect(result.reasons).toContainEqual(expect.stringContaining('javascript'));
  });

  test('flags data: URI as dangerous', () => {
    const result = classifyURL('data:text/html,<script>location="https://evil.com"</script>');
    expect(result.riskLevel).toBe('suspicious');
  });

  test('flags homograph domains', () => {
    const result = classifyURL('https://gοοgle.com'); // Greek omicron
    expect(result.riskLevel).toBe('dangerous');
    expect(result.reasons).toContainEqual(expect.stringContaining('Homograph'));
  });

  test('detects text vs href mismatch when displayText is provided', () => {
    const result = classifyURL('https://evil.com/steal', {
      displayText: 'https://facebook.com/login',
    });
    expect(result.riskLevel).toBe('suspicious');
    expect(result.reasons).toContainEqual(expect.stringContaining('facebook'));
  });

  test('returns safe for google.com', () => {
    const result = classifyURL('https://google.com');
    expect(result.riskLevel).toBe('safe');
  });

  test('flags typosquatting with distance 1', () => {
    const result = classifyURL('https://googl.com');
    expect(result.riskLevel).toBe('suspicious');
    expect(result.reasons).toContainEqual(expect.stringContaining('googl'));
  });

  test('returns score between 0-100', () => {
    const urls = [
      'https://safe-site.com',
      'https://gοοgle.com',
      'javascript:alert(1)',
      'https://bit.ly/xyz123',
      'https://example.com',
    ];
    for (const url of urls) {
      const result = classifyURL(url);
      expect(result.riskScore).toBeGreaterThanOrEqual(0);
      expect(result.riskScore).toBeLessThanOrEqual(100);
      expect(['safe', 'suspicious', 'dangerous']).toContain(result.riskLevel);
    }
  });
});

describe('classifyLinkElement', () => {
  function createMockLink(href, text = '', attrs = {}) {
    const el = { href, textContent: text, getAttribute: (key) => attrs[key] || null };
    return el;
  }

  test('classifies based on href and text content', () => {
    const el = createMockLink('https://evil.com', 'https://facebook.com');
    const result = classifyLinkElement(el);
    expect(result.reasons).toContainEqual(expect.stringContaining('destination'));
  });

  test('uses aria-label when text is empty', () => {
    const el = createMockLink('https://evil.com', '', { 'aria-label': 'https://facebook.com' });
    const result = classifyLinkElement(el);
    expect(result.reasons).toContainEqual(expect.stringContaining('destination'));
  });
});

describe('classifyURLs', () => {
  test('classifies multiple URLs', () => {
    const urls = ['https://example.com', 'https://gοοgle.com'];
    const results = classifyURLs(urls);
    expect(results.size).toBe(2);
    expect(results.get('https://example.com').riskLevel).toBe('safe');
    expect(results.get('https://gοοgle.com').riskLevel).toBe('dangerous');
  });
});
