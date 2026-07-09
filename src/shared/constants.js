/**
 * CleanClick — Shared Constants & Configuration
 *
 * Central config for all modules. Tweak thresholds here.
 */

// ─── Timing Thresholds ─────────────────────────────────────────────
export const TIMING = {
  /** Min ms between click and navigation to be considered user-initiated */
  CLICK_TO_NAV_MIN: 100,
  /** Max ms between click and navigation before considering it stale */
  CLICK_TO_NAV_MAX: 30_000,
  /** Rapid redirect chain: >N hops in <N ms */
  RAPID_REDIRECT_HOPS: 3,
  RAPID_REDIRECT_WINDOW: 2_000,
  /** Popup must be closed within N ms of detection */
  POPUP_CLOSE_TIMEOUT: 500,
  /** MutationObserver debounce delay */
  OBSERVER_DEBOUNCE_MS: 500,
  /** Max observer runtime before disconnect (per tab) */
  OBSERVER_MAX_LIFETIME_MS: 60_000,
  /** Scan only first N links on page load; rest on scroll/idle */
  INITIAL_SCAN_LIMIT: 200,
};

// ─── Risk Score Thresholds ─────────────────────────────────────────
export const RISK = {
  SAFE_MAX: 15,
  SUSPICIOUS_MAX: 50,
  // >60 = dangerous
  /** Default score (0 = safe, penalties added for suspicious features) */
  DEFAULT_SCORE: 0,
  /** Per hop penalty in redirect chain */
  PER_REDIRECT_PENALTY: 10,
  /** Penalty for known malicious redirect pattern */
  MALICIOUS_PATTERN_PENALTY: 30,
  /** Bonus for user marking as safe */
  USER_SAFE_BONUS: -10,
  /** Penalty for community report */
  COMMUNITY_REPORT_PENALTY: 20,
};

// ─── Hidden Link Detection ─────────────────────────────────────────
export const HIDDEN_LINK = {
  /** Consider element hidden if opacity below this */
  OPACITY_THRESHOLD: 0.01,
  /** Consider element zero-size if both dimensions below this (px) */
  SIZE_THRESHOLD: 2,
  /** Overlay coverage ratio to flag as clickjacking */
  OVERLAY_COVERAGE_MIN: 0.6,
  /** Z-index above this is suspicious for overlays */
  OVERLAY_ZINDEX_MIN: 1000,
  /** Grid cell size for z-index stacking detection (px) */
  STACK_GRID_SIZE: 50,
  /** Max entries in shadow registry per page */
  SHADOW_REGISTRY_LIMIT: 2000,
};

// ─── Link Classification ───────────────────────────────────────────
export const LINK_CLASS = {
  /** Max Levenshtein distance for homograph detection */
  HOMOGRAPH_MAX_DISTANCE: 1,
  /** Min script mix count to flag as suspicious (e.g., Latin + Cyrillic) */
  SCRIPT_MIX_MIN: 2,
  /** Popular domains to compare against for typosquatting */
  POPULAR_DOMAINS: [
    'google.com', 'facebook.com', 'youtube.com', 'amazon.com',
    'wikipedia.org', 'twitter.com', 'x.com', 'instagram.com',
    'linkedin.com', 'reddit.com', 'github.com', 'mozilla.org',
    'whatsapp.com', 'telegram.org', 'discord.com', 'twitch.tv',
    'netflix.com', 'spotify.com', 'paypal.com', 'apple.com',
    'microsoft.com', 'cloudflare.com', 'stackoverflow.com',
    'medium.com', 'wordpress.org', 'blogspot.com', 'yahoo.com',
    'bing.com', 'duckduckgo.com', 'github.io',
  ],
};

// ─── Event Types to Monitor for Hijacking ──────────────────────────
export const HIJACK_EVENTS = [
  'click', 'mousedown', 'mouseup', 'auxclick',
  'touchstart', 'touchend',
];

// ─── Suspicious Domains (seed list) ────────────────────────────────
export const SUSPICIOUS_DOMAINS = [
  // Pop-under / ad redirect networks
  'adserver.com', 'adsterra.com', 'propellerads.com',
  'popads.net', 'popunder.net', 'trafficfactory.com',
  'adreactor.com', 'clickadu.com', 'mgid.com',
  // Fake download / drive-by
  'fake-download.com', 'download-now.net', 'get-it-here.com',
  'softonic.com', 'downloadware.com', 'freedownload.net',
  // URL shorteners (legitimate but abused)
  'bit.ly', 'tinyurl.com', 'ow.ly', 'is.gd', 'buff.ly',
  'shorturl.at', 'cli.gs', 'goo.gl', 't.co', 'rebrand.ly',
  // Known malicious TLDs (heavy abuse)
  '.tk', '.ml', '.ga', '.cf', '.gq', '.xyz', '.top', '.work',
  '.click', '.download', '.review', '.trade', '.bid', '.date',
  '.webcam', '.men', '.loan', '.win', '.mom', '.party',
];

// ─── Tracking Parameters to Strip ──────────────────────────────────
export const TRACKING_PARAMS = [
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
  'fbclid', 'gclid', 'msclkid', 'ref', 'source', 'src',
  'mc_cid', 'mc_eid', '_ga', '_gl', 'yclid', 'igshid',
  'affiliate', 'aff', 'tag', 'siteid', 'campaignid', 'adid',
  'clickid', 'subid', 'subid1', 'subid2', 'subid3',
];

// ─── Scam Overlay Phrases ──────────────────────────────────────────
export const SCAM_PHRASES = [
  /your (computer|pc|system|device) (is )?(infected|compromised|at risk)/i,
  /you have won|congratulations|you.*won.*prize/i,
  /click here to (clean|fix|repair|scan|remove)/i,
  /scan your (pc|computer|device|system)/i,
  /verify you are human|prove you.*human/i,
  /your (data|information|privacy) has been compromised/i,
  /call (us )?now.*toll.?free|premium.*rate/i,
  /virus.*detected|malware.*found|security.*alert/i,
  /act (now|immediately)|limited time offer.*expires/i,
  /you have (\d+ )?viruses|(\d+ )?infections found/i,
];

// ─── Known URL Shorteners ──────────────────────────────────────────
export const SHORTENER_DOMAINS = new Set([
  'bit.ly', 'tinyurl.com', 'ow.ly', 'is.gd', 'buff.ly',
  'shorturl.at', 'cli.gs', 'goo.gl', 't.co', 'rebrand.ly',
  'tiny.cc', 'tr.im', 'v.gd', 'cutt.ly', 'rb.gy',
  'short.io', 'shrtco.de', '9qr.de', 'adf.ly', 'bc.vc',
  'bit.do', 'buzurl.com', 'cur.lv', 'db.tt', 'doiop.com',
  'flic.kr', 'gg.gg', 'go2l.ink', 'hide.my', 'iiiii.in',
  'korta.nu', 'link.zip.net', 'lnkd.in', 'migre.me', 'moourl.com',
  'nicou.ch', 'ownd.url', 'po.st', 'post.ly', 'q.gs',
  'qr.ae', 'qrius.me', 'r2u.org', 'redir.ec', 'redirects.to',
  'rix.eu', 'safeurl.eu', 'shorl.com', 'short.ie', 'shorter.link',
  'shortlinks.co.uk', 'shortna.me', 'smu.sg', 'sn.im', 'snipr.com',
  'snipurl.com', 'snurl.com', 'su.pr', 't9n.de', 'tiny.pl',
  'tinytw.it', 'tldrify.com', 'tny.im', 'to.ly', 'twitthis.com',
]);

// ─── Storage Keys ──────────────────────────────────────────────────
export const STORAGE_KEYS = {
  WHITELIST: 'whitelist',
  STATISTICS: 'statistics',
  SETTINGS: 'settings',
  CUSTOM_RULES: 'customRules',
  REPUTATION: 'reputationDb',
  LINK_CACHE: 'linkClassificationCache',
};

// ─── Message Types ─────────────────────────────────────────────────
export const MSG = {
  // Content → Background
  CLICK_RECORDED: 'click:recorded',
  EVENT_FLAG: 'event:flag',
  HIDDEN_LINKS_FOUND: 'hidden-links:found',
  LINK_VERIFICATION: 'link:verification',
  DYNAMIC_LINKS: 'dynamic-links:found',
  SCAM_OVERLAY: 'scam-overlay:detected',
  POPUP_BLOCKED: 'popup:blocked',

  // Background → Content
  BLOCK_DECISION: 'block:decision',
  WARNING_BANNER: 'warning:banner',
  REVEAL_HIDDEN: 'reveal:hidden',

  // Popup → Background
  GET_STATS: 'get:stats',
  GET_PROTECTION_STATUS: 'get:protection-status',
  TOGGLE_PROTECTION: 'toggle:protection',
  GET_LINK_SCAN: 'get:link-scan',
  TRIGGER_SCAN: 'trigger:scan',
  REVEAL_HIDDEN_REQUEST: 'reveal:hidden-request',
};

// ─── Default Settings ──────────────────────────────────────────────
export const DEFAULT_SETTINGS = {
  protectionEnabled: true,
  showRiskBadges: true,
  showTooltips: true,
  confirmLevel: 'suspicious', // 'never' | 'suspicious' | 'all'
  autoRevealHidden: false,
  sanitizeLinks: true,
  healthCheckEnabled: false,
  cloudReputationEnabled: false,
};
