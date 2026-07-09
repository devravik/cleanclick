/**
 * CleanClick - Shared Utilities
 *
 * Pure functions with no browser API dependencies.
 * All are testable without mocks.
 */

// ─── URL Parsing ───────────────────────────────────────────────────

/**
 * Parse a URL into components.
 * Safe - returns null instead of throwing on invalid URLs.
 * @param {string} url
 * @returns {{ protocol: string, hostname: string, port: string, pathname: string, search: string, hash: string, origin: string } | null}
 */
export function parseURL(url) {
  try {
    const u = new URL(url);
    return {
      protocol: u.protocol.replace(':', ''),
      hostname: u.hostname,
      port: u.port,
      pathname: u.pathname,
      search: u.search,
      hash: u.hash,
      origin: u.origin,
    };
  } catch {
    return null;
  }
}

/**
 * Normalize a URL for comparison: lowercase hostname, remove trailing slash, remove fragment.
 * @param {string} url
 * @returns {string}
 */
export function normalizeURL(url) {
  const parsed = parseURL(url);
  if (!parsed) return url.toLowerCase().trim();
  let normalized = `${parsed.protocol}://${parsed.hostname}`;
  if (parsed.port) normalized += `:${parsed.port}`;
  normalized += parsed.pathname.replace(/\/+$/, '') || '/';
  if (parsed.search) normalized += parsed.search;
  return normalized.toLowerCase();
}

/**
 * Extract domain parts from a hostname.
 * @param {string} hostname
 * @returns {{ subdomain: string, domain: string, tld: string, full: string }}
 */
export function getDomainParts(hostname) {
  const parts = hostname.split('.');
  if (parts.length < 2) return { subdomain: '', domain: hostname, tld: '', full: hostname };

  // Handle common multi-part TLDs (co.uk, com.au, etc.)
  // This is a simplified approach; a full list would be needed for production
  const multiPartTLDs = new Set([
    'co.uk', 'org.uk', 'ac.uk', 'gov.uk', 'net.uk',
    'com.au', 'net.au', 'org.au', 'gov.au',
    'co.nz', 'net.nz', 'org.nz',
    'co.jp', 'ne.jp', 'or.jp',
    'com.br', 'org.br', 'net.br', 'gov.br',
    'com.cn', 'net.cn', 'org.cn', 'gov.cn',
  ]);

  let tldParts = 1;
  if (parts.length >= 3) {
    const lastTwo = parts.slice(-2).join('.');
    if (multiPartTLDs.has(lastTwo)) tldParts = 2;
  }

  const tld = parts.slice(-tldParts).join('.');
  const domain = parts.length > tldParts ? parts[parts.length - tldParts - 1] : parts[0];
  const subdomain = parts.length > tldParts + 1 ? parts.slice(0, -tldParts - 1).join('.') : '';

  return { subdomain, domain, tld, full: hostname };
}

/**
 * Check if two URLs share the same domain (handles www vs non-www).
 * @param {string} url1
 * @param {string} url2
 * @returns {boolean}
 */
export function isSameDomain(url1, url2) {
  const p1 = parseURL(url1);
  const p2 = parseURL(url2);
  if (!p1 || !p2) return false;

  const d1 = getDomainParts(p1.hostname);
  const d2 = getDomainParts(p2.hostname);

  return d1.domain === d2.domain && d1.tld === d2.tld;
}

/**
 * Check if a URL points to a known shortener domain.
 * @param {string} url
 * @param {Set<string>} shortenerDomains
 * @returns {boolean}
 */
export function isShortenedURL(url, shortenerDomains) {
  const parsed = parseURL(url);
  if (!parsed) return false;
  return shortenerDomains.has(parsed.hostname) ||
    shortenerDomains.has(parsed.hostname.replace(/^www\./, ''));
}

// ─── Homograph Detection ───────────────────────────────────────────

/**
 * Confusable character map for homograph detection.
 * Maps lookalike characters to their ASCII equivalent.
 */
const CONFUSABLES = {
  'а': 'a', 'е': 'e', 'е': 'e', 'о': 'o', 'р': 'p', 'с': 'c',
  'у': 'y', 'х': 'x', 'і': 'i', 'ј': 'j', 'к': 'k', 'м': 'm',
  'н': 'h', 'т': 't', 'в': 'b', 'ь': 'b', 'г': 'r', 'ґ': 'r',
  'ї': 'i', 'є': 'e', 'ѕ': 's', 'ԁ': 'a', 'ɡ': 'g', 'ԛ': 'q',
  'ᴠ': 'v', 'ᴡ': 'w', 'ᴢ': 'z', 'ᴌ': 'l', 'ᴏ': 'o',
  // Greek
  'α': 'a', 'β': 'b', 'γ': 'y', 'ε': 'e', 'η': 'h',
  'ι': 'i', 'κ': 'k', 'μ': 'm', 'ν': 'n', 'ο': 'o',
  'π': 'p', 'ρ': 'p', 'σ': 's', 'τ': 't', 'χ': 'x',
  // Misc
  'ⲟ': 'o', 'ⲁ': 'a', 'ⲉ': 'e', 'ⲓ': 'i',
  '０': '0', '１': '1', '２': '2', '３': '3', '４': '4',
  '５': '5', '６': '6', '７': '7', '８': '8', '９': '9',
};

/**
 * Detect if a hostname uses homograph characters (mixed scripts).
 * @param {string} hostname
 * @returns {{ isHomograph: boolean, confusablesFound: string[], normalized: string }}
 */
export function detectHomograph(hostname) {
  const found = [];
  for (let i = 0; i < hostname.length; i++) {
    const char = hostname[i];
    if (CONFUSABLES[char]) {
      found.push({ char, position: i, replacement: CONFUSABLES[char] });
    }
  }

  if (found.length === 0) {
    return { isHomograph: false, confusablesFound: [], normalized: hostname };
  }

  // Build normalized version
  let normalized = '';
  for (const c of hostname) {
    normalized += CONFUSABLES[c] || c;
  }

  // Check if the normalized version matches a popular domain
  const normalizedLower = normalized.toLowerCase();
  const isMixedScript = found.length > 0;

  return {
    isHomograph: isMixedScript,
    confusablesFound: found.map(f => `${f.char}→${f.replacement} at pos ${f.position}`),
    normalized: normalizedLower,
  };
}

/**
 * Levenshtein distance between two strings.
 * Used for typosquatting detection.
 */
export function levenshteinDistance(a, b) {
  const matrix = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost,
      );
    }
  }
  return matrix[a.length][b.length];
}

/**
 * Check for zero-width / invisible Unicode characters in a string.
 * @param {string} str
 * @returns {{ found: boolean, chars: { codePoint: number, position: number }[] }}
 */
export function detectInvisibleChars(str) {
  const invisible = [0x200B, 0x200C, 0x200D, 0xFEFF, 0x00AD, 0x2060, 0x2061, 0x2062, 0x2063, 0x2064];
  const found = [];
  for (let i = 0; i < str.length; i++) {
    const cp = str.codePointAt(i);
    if (cp !== undefined && invisible.includes(cp)) {
      found.push({ codePoint: cp, position: i });
    }
  }
  return { found: found.length > 0, chars: found };
}

/**
 * Check for Unicode bidirectional override characters.
 * @param {string} str
 * @returns {{ found: boolean, positions: number[] }}
 */
export function detectBidiOverrides(str) {
  const bidi = [0x202A, 0x202B, 0x202C, 0x202D, 0x202E, 0x2066, 0x2067, 0x2068, 0x2069];
  const positions = [];
  for (let i = 0; i < str.length; i++) {
    const cp = str.codePointAt(i);
    if (cp !== undefined && bidi.includes(cp)) {
      positions.push(i);
    }
  }
  return { found: positions.length > 0, positions };
}

// ─── Performance Utilities ────────────────────────────────────────

/**
 * Debounce a function - waits `ms` after last call before executing.
 * @param {Function} fn
 * @param {number} ms
 * @returns {Function}
 */
export function debounce(fn, ms) {
  let timer = null;
  const debounced = (...args) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      fn(...args);
    }, ms);
  };
  debounced.cancel = () => {
    if (timer) clearTimeout(timer);
    timer = null;
  };
  return debounced;
}

/**
 * Throttle a function - at most once per `ms` interval.
 * @param {Function} fn
 * @param {number} ms
 * @returns {Function}
 */
export function throttle(fn, ms) {
  let lastCall = 0;
  let timer = null;
  const throttled = (...args) => {
    const now = Date.now();
    const elapsed = now - lastCall;
    if (elapsed >= ms) {
      lastCall = now;
      fn(...args);
    } else if (!timer) {
      timer = setTimeout(() => {
        timer = null;
        lastCall = Date.now();
        fn(...args);
      }, ms - elapsed);
    }
  };
  throttled.cancel = () => {
    if (timer) clearTimeout(timer);
    timer = null;
  };
  return throttled;
}

/**
 * Run a function using requestIdleCallback if available, else setTimeout.
 * @param {Function} fn
 * @param {number} [timeout=2000]
 */
export function runIdle(fn, timeout = 2000) {
  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(() => fn(), { timeout });
  } else {
    setTimeout(fn, 1);
  }
}

// ─── URL Normalization for Comparison ──────────────────────────────

/**
 * Strip tracking parameters from a URL.
 * @param {string} url
 * @param {string[]} trackingParams - List of param names to strip
 * @returns {string} Clean URL
 */
export function stripTrackingParams(url, trackingParams) {
  try {
    const u = new URL(url);
    let changed = false;
    for (const param of trackingParams) {
      if (u.searchParams.has(param)) {
        u.searchParams.delete(param);
        changed = true;
      }
    }
    return changed ? u.toString() : url;
  } catch {
    return url;
  }
}

/**
 * Extract the domain from a URL string, with normalization.
 * @param {string} url
 * @returns {string|null}
 */
export function extractDomain(url) {
  const parsed = parseURL(url);
  return parsed ? parsed.hostname : null;
}

/**
 * Check if a URL uses a non-standard protocol (not http/https).
 * @param {string} url
 * @returns {{ isNonStandard: boolean, protocol: string }}
 */
export function checkProtocol(url) {
  const parsed = parseURL(url);
  if (!parsed) return { isNonStandard: true, protocol: 'unknown' };
  return {
    isNonStandard: !['http', 'https'].includes(parsed.protocol),
    protocol: parsed.protocol,
  };
}
