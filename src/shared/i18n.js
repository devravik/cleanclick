/**
 * CleanClick — Translation Helper
 *
 * Wraps browser.i18n.getMessage() with placeholder substitution.
 * Works in popup, options, and background contexts.
 */

export function t(key, ...args) {
  try {
    let msg = browser.i18n.getMessage(key);
    if (!msg) {
      console.warn('Missing translation key:', key);
      msg = key;
    }
    if (args.length > 0) {
      for (let i = 0; i < args.length; i++) {
        msg = msg.replace(new RegExp('\\$' + (i + 1), 'g'), String(args[i]));
      }
    }
    return msg;
  } catch (e) {
    return key;
  }
}

export function applyLanguage(lang) {
  if (lang && lang !== 'auto') {
    document.documentElement.lang = lang;
  } else {
    try {
      const uiLang = browser.i18n.getUILanguage().split('-')[0];
      document.documentElement.lang = uiLang;
    } catch {
      document.documentElement.lang = 'en';
    }
  }
}
