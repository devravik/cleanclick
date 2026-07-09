/**
 * Shared test data and helper functions for all unit/integration tests.
 */

export const TEST_URLS = {
  safe: [
    'https://example.com',
    'https://www.google.com',
    'https://github.com',
    'https://mozilla.org',
    'https://example.com/page?q=search#section',
  ],
  suspicious: [
    'https://spam.example.com',
    'https://malware-download.example.net',
    'https://fake-login.example.org/facebook',
    'https://bit.ly/3xyz123',
    'https://tinyurl.com/abc123',
  ],
  homograph: [
    'https://www.xn--80aqmcc3a.com', // cyrillic homograph
    'https://xn--gld-fma.com', // greek omicron
  ],
  hiddenPatterns: [
    'opacity:0',
    'width:0;height:0',
    'position:absolute;left:-9999px',
    'font-size:0',
    'color:#fff;background:#fff',
  ],
  eventHijackPatterns: [
    'window.location.href =',
    'window.location =',
    'location.assign(',
    'window.open(',
    'setTimeout(function() { window.location',
  ],
  protocols: {
    http: 'http://example.com',
    https: 'https://example.com',
    tel: 'tel:+1234567890',
    sms: 'sms:+1234567890?body=subscribe',
    mailto: 'mailto:user@example.com',
    intent: 'intent://example.com#Intent;end',
    javascript: 'javascript:void(0)',
    data: 'data:text/html,hello',
    blob: 'blob:1234-5678',
  },
};

export const TEST_DOMAINS = {
  popular: [
    'google.com', 'facebook.com', 'youtube.com', 'amazon.com',
    'wikipedia.org', 'twitter.com', 'instagram.com', 'linkedin.com',
    'reddit.com', 'github.com', 'mozilla.org', 'example.com',
  ],
  suspicious: [
    'spam.example.com', 'malware.example.net', 'phishing.example.org',
    'fake-download.example.io', 'popup-ad.example.biz',
  ],
};

export function createMockElement(tagName = 'a', attributes = {}, style = {}) {
  const el = document.createElement(tagName);
  Object.entries(attributes).forEach(([k, v]) => el.setAttribute(k, v));
  Object.assign(el.style, style);
  return el;
}

export function createMockEvent(type = 'click', overrides = {}) {
  return new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    button: 0,
    clientX: 100,
    clientY: 100,
    ...overrides,
  });
}

export function createMockTab(overrides = {}) {
  return { id: 1, url: 'https://example.com', active: true, ...overrides };
}

export function createMockNavigationDetails(overrides = {}) {
  return {
    tabId: 1,
    url: 'https://example.com',
    timeStamp: Date.now(),
    frameId: 0,
    parentFrameId: -1,
    ...overrides,
  };
}
