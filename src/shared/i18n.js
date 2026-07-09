/**
 * CleanClick — Translation Helper
 *
 * Loads locale JSON files directly (bypasses browser.i18n.getMessage
 * which only uses the browser's UI language, ignoring user settings).
 *
 * Falls back: selected language → browser UI language → English → key name
 */

let currentLang = 'auto';
let localeCache = {};
let fallbackLocale = {};
let englishLocale = {};

/**
 * Load a locale JSON file from the extension's _locales directory.
 */
async function loadLocale(lang) {
  try {
    const url = browser.runtime.getURL('_locales/' + lang + '/messages.json');
    const res = await fetch(url);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    const flat = {};
    for (const [key, val] of Object.entries(data)) {
      flat[key] = val.message;
    }
    return flat;
  } catch (e) {
    console.warn('CleanClick: Failed to load locale [' + lang + ']:', e.message);
    return null;
  }
}

/**
 * Initialize the translation system.
 * Loads English as base fallback, plus the user's selected language
 * and the browser's UI language for cascading fallback.
 * @param {string} lang - 'auto' or language code (e.g. 'hi', 'es')
 */
export async function initI18n(lang) {
  currentLang = lang || 'auto';

  // Always load English as ultimate fallback
  englishLocale = await loadLocale('en') || {};

  // Load browser UI language as secondary fallback
  let uiLang = 'en';
  try { uiLang = (browser.i18n.getUILanguage() || 'en').split('-')[0]; } catch {}
  fallbackLocale = await loadLocale(uiLang) || {};

  // Load user-selected language if not auto
  if (lang && lang !== 'auto' && lang !== 'en' && lang !== uiLang) {
    const userLocale = await loadLocale(lang);
    if (userLocale) localeCache = userLocale;
    else localeCache = fallbackLocale;
  } else if (lang && lang !== 'auto') {
    localeCache = lang === 'en' ? englishLocale : fallbackLocale;
  } else {
    localeCache = fallbackLocale;
  }

  // Set document language
  setDocumentLang(lang || uiLang);

  // Re-render UI if locale actually changed
  return true;
}

/**
 * Translate a message key with optional placeholder substitution.
 * Cascade: user-selected → browser UI language → English → key name
 * @param {string} key
 * @param {...(string|number)} args - Substitutions for $1, $2, ...
 * @returns {string}
 */
export function t(key, ...args) {
  let msg = localeCache[key] || fallbackLocale[key] || englishLocale[key] || key;

  if (args.length > 0) {
    for (let i = 0; i < args.length; i++) {
      msg = msg.replace(new RegExp('\\$' + (i + 1), 'g'), String(args[i]));
    }
  }
  return msg;
}

/**
 * Alias for backward compatibility with browser.i18n.getMessage API.
 */
export function getMessage(key, ...args) {
  return t(key, ...args);
}

/**
 * Set the document language attribute.
 */
function setDocumentLang(lang) {
  const l = lang === 'auto' ? 'en' : lang;
  document.documentElement.lang = l;
}

/**
 * Get the current effective language code.
 */
export function getCurrentLanguage() {
  return currentLang;
}

/**
 * Apply language setting: loads locale and re-renders.
 * @param {string} lang 
 */
export async function applyLanguage(lang) {
  await initI18n(lang);
}
