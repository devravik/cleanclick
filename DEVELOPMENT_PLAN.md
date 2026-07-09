# CleanClick — Development Plan

> Based on README.md analysis | Generated: 2026-07-09

## 1. Project Overview

CleanClick is a Firefox extension that protects users from unwanted redirects, pop-under ads, fake download buttons, and malicious navigation tricks. It is currently an **empty repository** (only `README.md` exists).

**Tech Stack:**
- **Runtime:** Firefox WebExtensions API (Manifest V3)
- **Language:** JavaScript (ES modules)
- **Build:** npm + webpack or rollup (per README)
- **UI:** HTML/CSS/JS for popup + options pages
- **Storage:** `browser.storage.local` / `browser.storage.sync`
- **Testing:** Jest + webextension-polyfill for unit tests

---

## 0. Gap Summary

> A full gap analysis is available in `SPAM_LINK_GAP_ANALYSIS.md`. Key finding: the original plan covers only **~5% of 96 identified spam link attack vectors**. Below is the revised plan that raises coverage to ~40% in Phase 1 and ~85% by Phase 2.

**Three Critical Additions (must be in Phase 1):**
1. **Hidden Link Scanner** — Transparent overlays, zero-opacity, off-screen, and size-0 links (rampant on download/streaming sites).
2. **Link Verifier** — Hover spoofing, homograph domains (Punycode/IDN), Base tag hijacking, and href mutation.
3. **Event Layer Inspector** — Click/mouseup/touch event listener hijacking detection before the user interacts.

---

## 2. Phase 0 — Project Scaffolding

### 2.1 Initialize npm project
- `package.json` with name, version, scripts, dependencies
- `.gitignore`
- `.eslintrc.js` (or flat config) for code quality
- Webpack or Rollup config for bundling extension files

### 2.2 Directory Structure

```
cleanclick/
├── README.md
├── DEVELOPMENT_PLAN.md            # This file
├── CONTRIBUTING.md
├── LICENSE
├── package.json
├── webpack.config.js
├── .gitignore
├── .eslintrc.js
│
├── src/
│   ├── manifest.json              # Firefox manifest V3
│   │
│   ├── background/
│   │   ├── index.js               # Background service worker entry
│   │   ├── redirect-detector.js   # Core redirect analysis logic
│   │   ├── popup-blocker.js       # window.open interception
│   │   ├── whitelist-manager.js   # User whitelist CRUD
│   │   ├── statistics.js          # Stats collection & aggregation
│   │   ├── reputation.js          # (v1.5) Redirect reputation scoring
│   │   ├── event-coordinator.js   # 🔴 NEW — Coordinates event analysis across tabs
│   │   └── link-health-pinger.js  # 🟢 NEW — Optional reputation pings (v2.0)
│   │
│   ├── content-scripts/
│   │   ├── click-monitor.js       # Click event recording
│   │   ├── event-inspector.js     # 🔴 NEW — Event listener stack analysis (Phase 1a)
│   │   ├── hidden-link-scanner.js # 🔴 NEW — Invisible/obscured link detection (Phase 1b)
│   │   ├── link-verifier.js       # 🔴 NEW — Hover/href comparison, homograph (Phase 1b)
│   │   ├── dynamic-link-watcher.js # 🟠 NEW — MutationObserver for post-load links (Phase 1.5)
│   │   ├── scam-overlay-detector.js # 🟠 NEW — Social eng. overlay detection (Phase 1.5)
│   │   ├── protocol-link-validator.js # 🟡 NEW — tel:/sms:/intent: validation (Phase 2)
│   │   ├── link-transparency-ui.js # 🟠 NEW — Risk badges, tooltips, dialogs (Phase 2)
│   │   ├── link-density-analyzer.js # 🟢 NEW — Page link count & keyword analysis (Phase 3)
│   │   ├── link-sanitizer.js      # 🟡 NEW — Tracking param stripping (Phase 2)
│   │   ├── edge-case-handler.js   # 🟡 NEW — SVG, custom elements, unicode (Phase 2)
│   │   ├── fake-button-detector.js # (v1.5) Fake download button detection
│   │   └── navigation-guard.js    # ⬆️ EXPANDED — Forms, meta-refresh, SW, history API
│   │
│   ├── popup/
│   │   ├── index.html
│   │   ├── popup.js               # Popup controller
│   │   ├── popup.css
│   │   └── components/
│   │       ├── stats-panel.js     # Statistics display
│   │       ├── whitelist-panel.js # Whitelist management
│   │       ├── protection-toggle.js # Per-site enable/disable
│   │       ├── link-scanner-report.js # 🟠 NEW — Scan results for current page
│   │       └── link-risk-dashboard.js # 🟡 NEW — All-links risk overview
│   │
│   ├── options/
│   │   ├── index.html
│   │   ├── options.js
│   │   ├── options.css
│   │   └── components/
│   │       ├── whitelist-manager.js
│   │       ├── custom-rules-editor.js
│   │       └── link-preview-settings.js # 🟠 NEW — Hover/tooltip preferences
│   │
│   ├── shared/
│   │   ├── constants.js           # Config, thresholds, domain lists
│   │   ├── messaging.js           # Port/Message protocol helpers
│   │   ├── storage.js             # Storage abstraction layer
│   │   ├── utils.js               # URL parsing, domain extraction, etc.
│   │   ├── link-classifier.js     # 🟠 NEW — Link risk scoring engine
│   │   └── event-analyzer.js      # 🟠 NEW — Event listener pattern matcher
│   │
│   ├── assets/
│   │   ├── icons/                 # Extension icons (16, 32, 48, 96, 128)
│   │   └── fonts/                 # (optional) Custom fonts
│   │
│   └── _locales/
│       └── en/
│           └── messages.json      # i18n strings
│
├── tests/
│   ├── unit/
│   │   ├── redirect-detector.test.js
│   │   ├── whitelist-manager.test.js
│   │   ├── popup-blocker.test.js
│   │   └── statistics.test.js
│   ├── integration/
│   │   └── navigation-flow.test.js
│   └── fixtures/
│       └── mock-data.js
│
└── docs/
    └── architecture.md
```

---

## 3. Phase 1 — Foundation & Core Features (v1.0 Milestone)

### 3.1 Manifest & Extension Shell
- **manifest.json** (Manifest V3):
  - Permissions: `tabs`, `webNavigation`, `storage`, `scripting`, `declarativeNetRequest`
  - Host permissions: `"<all_urls>"` initially, refine later
  - Background service worker
  - Browser action popup
  - Options page
  - Default locale `en`

### 3.2 Shared Infrastructure
- **`constants.js`** — Suspicious domain lists, timing thresholds, config keys, link risk thresholds, hidden link CSS patterns
- **`storage.js`** — Wrapper around `browser.storage.local` with defaults and migration support
- **`messaging.js`** — Typed message passing between background ↔ content ↔ popup; includes new message types for link scans, event analysis, and overlay detection
- **`link-classifier.js`** — 🔴 NEW Link risk scoring engine: normalizes URLs, checks homographs, compares displayed text vs href, assigns risk scores
- **`event-analyzer.js`** — 🔴 NEW Event listener pattern matcher: analyzes registered listeners for hijacking patterns (redirect override, different-domain navigation)

### 3.3 Smart Redirect Protection (`redirect-detector.js`)

**Click Context Recording:**
- Content script (`click-monitor.js`) records `click` events on `<a>` tags
- Captures: `href`, `linkText`, `timestamp`, `tabId`, `frameId`
- Sends context to background via messaging

**Event Layer Inspector** (`event-inspector.js`) — 🔴 NEW — Critical gap fix
- Before a user interacts, analyzes the event listener stack on every link/button
- Detects listeners (`click`, `mousedown`, `mouseup`, `auxclick`, `touchstart`, `touchend`) that:
  - Call `window.location` / `location.href` / `location.assign()` to a different domain than the element's href
  - Call `window.open()` with a different URL than the element's href
  - Set `window.location` after a timeout (deferred hijack)
  - Intercept middle-click (auxclick) for "open in new tab" hijacking
- Flags elements with hijacking-capable listeners and sends to background
- **Defensive action:** Approximate solution — since Firefox doesn't expose `getEventListeners()`, use a wrapper approach:
  - Monkey-patch `EventTarget.prototype.addEventListener` in the content script to track registrations
  - Build a shadow registry of all listeners per element
  - Check the registry before user interaction

**Navigation Monitoring:**
- Listen to `webNavigation.onCommitted`, `webNavigation.onCreatedNavigationTarget`
- Correlate navigation events with recorded click context

**Suspicious Redirect Detection Heuristics:**
- Navigation origin does not match user's intended domain
- Interstitial redirection chain (multiple rapid navigations)
- Pop-under (new tab opened in background, focus stolen)
- Timing analysis: redirect occurs outside human reaction window (<300ms or >10s)
- Event listener override detected (from event-inspector)

**Blocking Actions:**
- Close unwanted tabs (`tabs.remove`)
- Return focus to original tab (`tabs.update` with `active: true`)
- Show notification via `browser.notifications` or in-page warning
- If event hijack detected before click: show in-page warning banner "This link may be hijacked"

### 3.4 Popup Prevention (`popup-blocker.js`)
- **Content Script Injection:**
  - Inject beforeunload handler and override `window.open` in content scripts
  - Monitor `window.open` calls for suspicious patterns
- **Suspicious Popup Criteria:**
  - Opened without user gesture (not inside click handler)
  - Destination domain differs from origin by more than 2 TLDs
  - Popup URL matches known ad/malware patterns
- **Blocking:**
  - Return `null` from intercepted `window.open`
  - If popup already opened, close via background script

### 3.5 Hidden Link Scanner (`hidden-link-scanner.js`) — 🔴 NEW — Critical gap

**Purpose:** Detect invisible/obscured links that users cannot see but can accidentally click.

**Detection Vectors:**
| # | Technique | CSS/JS Pattern | Detection Method |
|---|-----------|----------------|------------------|
| 1 | Zero-opacity links | `opacity: 0` / `opacity: 0.0` | `getComputedStyle(el).opacity < 0.01` |
| 2 | Zero-size links | `width: 0` / `height: 0` / `1px` | `el.offsetWidth < 2 && el.offsetHeight < 2` |
| 3 | Off-screen links | `position: absolute; left: -9999px` | `el.getBoundingClientRect()` outside viewport |
| 4 | Font-size 0 links | `font-size: 0` | `getComputedStyle(el).fontSize === '0px'` |
| 5 | Color-matched links | `color` == `background-color` | Compare computed text color vs parent/body background |
| 6 | Overflow hidden | Inside `overflow: hidden` clip region | Check parent clip rect vs element position |
| 7 | Z-index stacked | Multiple `<a>` at same coordinates | Group elements by position, flag stacked links |
| 8 | Transparent overlay | `position: fixed/absolute; inset: 0; opacity: 0` | Detect full-coverage transparent elements |
| 9 | Whitespace area links | `<a>` with `&nbsp;` or spaces as content | `el.textContent.trim() === ''` + normal size |

**Content script behavior:**
- Scans all `<a>`, `<area>`, and `<button>` elements on page load
- Uses `getComputedStyle` for accurate rendered styles
- Groups overlapping elements by coordinate to detect z-index stacking attacks
- Reports all hidden links to background with: tag name, href, coordinates, hiding method
- **User-facing action:** Show warning badge on toolbar if hidden links found; offer "Reveal hidden links" option in popup that visually highlights them with a dashed red border overlay

**Edge cases:**
- Elements hidden via `visibility: hidden` but still clickable via keyboard tab
- Links inside `clip-path: polygon(0 0, 0 0, 0 0, 0 0)`
- Links with `aria-hidden="true"` but still in tab order (some screen readers still navigate)
- Hidden links inside Shadow DOM (use `shadowRoot` traversal)

### 3.6 Link Verifier (`link-verifier.js`) — 🔴 NEW — Critical gap

**Purpose:** Detect link spoofing — when the visible representation of a link differs from its actual destination.

**Detection Modules:**

**A. Hover Spoofing Detection**
- Monitor `mouseenter`/`mouseover` events on `<a>` elements
- Compare the URL shown in browser status bar (from href) vs any CSS `:hover` `content` or `attr()` changes
- Compare href at hover time vs href at click time (detect dynamic mutation)
- Flag links where href is modified between hover and click events

**B. Link Text vs Href Discrepancy**
- Compare `element.textContent` (visible text) vs `element.href` (actual URL)
- Heuristic: if text contains a domain that doesn't match the href's domain → flag
- Example: text says "facebook.com" but href points to `suspicious-site.net/facebook`
- Also flag if the TLD differs between text and href

**C. Punycode/IDN Homograph Detection**
- Normalize all URLs using `punycode.toASCII()` and `String.prototype.normalize('NFKC')`
- Check for mixed-script confusables (e.g., Cyrillic 'а' in Latin text)
- Compare against a confusable character table (built-in mapping of ~200 lookalike chars)
- Flag domains that use homograph characters to mimic popular domains
- Example: `gοοgle.com` (Greek omicron) vs `google.com` (Latin o)

**D. Base Tag Hijacking Detection**
- Check `<base>` element on page load
- If `<base href>` points to an external domain (different from page origin) → warn user
- All relative links are potentially hijacked via base tag — scan all resolved URLs

**E. JavaScript Protocol & Data URI Detection**
- Flag `<a href="javascript:...">` links that execute code instead of navigating
- Flag `<a href="data:text/html,...">` links that render a full page
- Flag `<a href="blob:...">` links with dynamically created content

**F. Subdomain Confusion Detection**
- Parse domain into `[subdomain].[domain].[tld]` parts
- Flag when a subdomain contains a well-known brand name
- Example: `paypal.security-alert.suspicious-site.com` — "paypal" appears as subdomain but is not the actual domain

**User-facing:**
- Color-code links on hover: 🟢 safe, 🟡 suspected different domain, 🔴 homograph/hijack detected
- Show a custom tooltip (in link-transparency-ui.js) with: displayed domain → actual domain comparison
- Click interception: for 🔴 links, show confirmation dialog before navigating
- CRUD operations on a user-managed whitelist
- UI in popup: quick toggle per domain
- UI in options page: full list with add/remove
- Whitelist stored in `browser.storage.sync` for cross-device sync (v2.0)
- Pattern matching: exact domain, subdomain wildcards, regex support (v1.5)

### 3.7 Website Whitelist (`whitelist-manager.js`)
- CRUD operations on a user-managed whitelist
- UI in popup: quick toggle per domain
- UI in options page: full list with add/remove
- Whitelist stored in `browser.storage.sync` for cross-device sync (v2.0)
- Pattern matching: exact domain, subdomain wildcards, regex support (v1.5)
- **NEW integration:** Hidden links found on whitelisted domains are still reported but not blocked; user is notified in popup

### 3.8 Statistics (`statistics.js`)
- Counters: redirects blocked, popups prevented, suspicious domains detected
- Session-based metrics + cumulative totals
- Store in `browser.storage.local` with daily rollups
- Display in popup with simple chart (CSS bars or canvas)

### 3.9 Popup UI
- Clean, minimal design matching Firefox Proton/Photon design
- Sections:
  1. Protection status (enabled/disabled for current site)
  2. Toggle button (enable/disable on current domain)
  3. Statistics summary (4 counters with icons)
  4. "Settings" link to full options page

### 3.10 Options Page
- Whitelist management (add/remove domains)
- Export/Import whitelist (JSON)
- Reset statistics
- Future: custom rule editor placeholder

---

## 4. Phase 2 — Enhanced Protection (v1.5 Milestone)

### 4.1 Expanded Navigation Guard (`navigation-guard.js`) — ⬆️ EXPANDED

The original `navigation-guard.js` is expanded from simple link monitoring to cover all non-`<a>` navigation vectors:

**Form Submission Hijacking Detection:**
- Intercept `<form>` submissions via `beforeSubmit` event (or monkey-patch `HTMLFormElement.prototype.submit`)
- Compare `form.action` against trusted domains (current page origin, whitelisted)
- Flag forms submitting to different domains than the page origin
- Warn before form data is sent to external/untrusted domains

**Meta Refresh Detection:**
- Scan for `<meta http-equiv="refresh" content="...">` tags
- If auto-redirect is set with `url=` parameter pointing to a different domain → intercept and warn
- Show a "This page is trying to redirect you" overlay with: destination URL, countdown, cancel button

**JavaScript Protocol & Data URI Blocking:**
- Intercept clicks on `javascript:` links and show confirmation
- Intercept clicks on `data:text/html` links that render full pages
- Intercept `blob:` links that were created from untrusted script context

**Service Worker Registration Monitoring:**
- Monkey-patch `navigator.serviceWorker.register()` to log registrations
- If a service worker URL belongs to a different domain or a known spam domain → warn user
- Optionally: unregister suspicious service workers

**History API Abuse Detection:**
- Monkey-patch `history.pushState` and `history.replaceState`
- If URL changes to a different origin via history API (phishing tactic) → warn
- Track history state changes per session for analysis

**PostMessage Origin Validation:**
- Monitor `window.postMessage` and `message` event listeners
- Flag `location.href` changes triggered by postMessage from untrusted origins

### 4.2 Dynamic Content Monitor (`dynamic-link-watcher.js`) — 🟠 NEW

**Purpose:** Detect spam links injected after the initial page load.

**Implementation:**
- `MutationObserver` on `document.body` with `{ childList: true, subtree: true }`
- On each mutation, scan added nodes for:
  - New `<a>` elements
  - New `<form>` / `<area>` / `<button>` elements
  - New `<iframe>` elements (possible ad injection)
  - Text nodes containing URLs that should become links (auto-linked by page scripts)
- **Shadow DOM traversal:** Recursively enter open shadow roots to find hidden links
- **Snapshot comparison:** Maintain a map of all known links. Compare new scans against previous scans. If a link's `href` changed between scans → flag as "mutated link."
- **Rate limiting:** Debounce observer (500ms) + batch processing to avoid performance issues

**User feedback:**
- Badge counter on toolbar showing "X new links detected since page loaded"
- Popup lists dynamically added links with timestamps
- Option to auto-scan injected links and flag suspicious ones

### 4.3 Scam Overlay Detector (`scam-overlay-detector.js`) — 🟠 NEW

**Purpose:** Detect social engineering overlays — fake virus warnings, prize scams, fake CAPTCHAs.

**Detection:**
- Monitor for elements that:
  - Appear suddenly (via MutationObserver with timing)
  - Are positioned `fixed` or `absolute` covering >60% of viewport
  - Have high z-index (>1000) suggesting a modal/overlay
- **Content analysis** (text matching against known scam phrases):
  - "Your computer is infected"
  - "You have won" / "Congratulations"
  - "Click here to clean" / "Scan your PC"
  - "Verify you are human" (fake CAPTCHA)
  - "Your data has been compromised"
  - Premium rate SMS/phone number patterns
- **Fake close button detection:**
  - Analyze all buttons/links within the overlay
  - If a button labeled "X" / "Close" / "Cancel" has a click handler that redirects to a different domain → flag
  - If clicking outside the overlay triggers navigation → flag

**User action:**
- Show warning notification: "Suspicious overlay detected on this page"
- Offer "Close overlay" button that removes the overlay element from DOM
- Log the overlay URL and scam type in statistics

### 4.4 Fake Download Button Detection (`fake-button-detector.js`)
- **Content Script Analysis:**
  - Scan page DOM for elements that look like download buttons (class names, aria-labels, button text)
  - Compare visual prominence vs actual download behavior
  - Highlight legitimate download buttons with a small overlay badge
- **Heuristics:**
  - Buttons with `download` attribute or `Content-Disposition: attachment` response
  - Button position relative to ads (above-the-fold vs embedded in ad iframes)
  - Hover target inspection (where does the link truly point?)
- **UI:**
  - Small green check badge on legitimate buttons
  - Warning toast on suspected fake buttons

### 4.5 Redirect Reputation Scoring (`reputation.js`)
- **Local Scoring Engine:**
  - Track redirect chains per domain
  - Score domains based on:
    - Number of intermediary redirects
    - Known redirect patterns (e.g., `adserver → tracker → destination`)
    - User feedback (manual "this was malicious" / "this was safe")
  - Scores stored locally in IndexedDB for performance
- **Domain Classification:**
  - Green: Trusted (no redirects, known-safe)
  - Yellow: Suspicious (1-2 redirects, unknown domain)
  - Red: Malicious (known redirect chains, community flagged)

### 4.6 Custom Blocking Rules
- **Rule Engine:**
  - User-defined rules: `if URL matches pattern → action (block, warn, allow)`
  - Pattern syntax: glob, regex, or simple domain match
  - Actions: block navigation, show warning, allow silently
  - Rules stored in `browser.storage.local`
- **UI:** Rule editor in options page with table view + add/edit/delete

---

## 5. Phase 3 — Advanced Features (v2.0 — Standalone Only)

> **Note:** Cloud-dependent features (Cloud Reputation, Community Reporting, AI-powered detection, Cross-Device Sync) were intentionally excluded — CleanClick is a fully standalone extension with zero external dependencies. The following features were implemented client-side only.

### 5.1 Clipboard Hijacking Protection
- **Content Script (\`clipboard-guard.js\`):**
  - Monkey-patches \`navigator.clipboard.writeText()\` and \`navigator.clipboard.write()\`
  - Detects crypto address patterns placed in clipboard by scripts
  - Detects silent clipboard modification after user copy events
  - Monitors \`document.execCommand('copy')\` as fallback
  - Shows in-page warning and logs to background

### 5.2 URL Shortener Bypass
- **Detection:** 50+ shortener domains (bit.ly, t.co, tinyurl.com, etc.)
- **Behavior:** Intercepts clicks, expands via HEAD request, shows destination
- **Caching:** 24h TTL, local only
- **Privacy:** Direct HTTP HEAD requests — no third-party API calls

### 5.3 Link Density Analyzer
- **Content Script (\`link-density-analyzer.js\`):**
  - Analyzes link count, external domains, link-to-text ratio
  - Detects keyword stuffing and link farms
  - Shows warning on high-density pages

### 5.4 Link Health Checker
- **Background Script (\`link-health-pinger.js\`):**
  - Proactive HEAD requests to check reachability
  - Queue-based (3 concurrent, 5s timeout), 24h cache
  - Privacy-first, disabled by default
## 6. Phase 3 — Link Transparency & Advanced Protections (v2.0 +)

### 6.1 Protocol Link Validator (`protocol-link-validator.js`) — 🟡 NEW

**Purpose:** Protect users from abuse of non-HTTP protocols (tel:, sms:, mailto:, intent:, facetime:, etc.).

**Detection:**
- Categorize all links by protocol scheme
- For `tel:` links: check phone number format, flag premium-rate numbers using area code / prefix heuristics
- For `sms:` links: warn if body parameter appears to subscribe user to a premium service
- For `intent://` / `facetime:` / `skype:` links: warn before launching external application
- For `mailto:` links: detect hidden email harvesting (links not visible but in DOM)

**User action:**
- Show confirmation dialog before launching external protocols
- Display destination phone number/email with risk rating
- Allowlist trusted protocols for specific domains

### 6.2 Link Transparency UI (`link-transparency-ui.js`) — 🟠 NEW

**Purpose:** Give users visual feedback about every link on the page, building trust and awareness.

**Features:**

**A. Risk Badges on Links**
- After scanning (hidden links, verification, classification), overlay small colored badges on links:
  - 🟢 Green dot: Safe link (verified, same domain, no redirects)
  - 🟡 Yellow dot: Suspicious (different domain, short URL, 1 redirect)
  - 🔴 Red dot: Dangerous (homograph, hijacked listener, known spam)
  - ⚪ Gray dot: Unknown (not yet classified)
- Badges appear on hover or always-visible (user setting)

**B. Custom Tooltip Component**
- Replace browser's native status bar tooltip with a custom one showing:
  - Actual destination URL (full, decoded)
  - Redirect chain length (if known)
  - Risk score (0-100)
  - Domain registration info (via WHOIS lookup in v2.0)
  - "Why this link is risky" explanation
  - Quick actions: "Copy clean link," "Report as spam"

**C. Click Confirmation Dialog**
- For medium-risk (yellow) links: show unobtrusive confirmation bar at top of page
- For high-risk (red) links: show modal dialog requiring explicit confirmation
- Dialog shows: actual destination, why it's risky, options to proceed/ignore/report

**D. Right-Click Link Inspector (via `menus` API)**
- Enhanced context menu with:
  - "Check link safety" — runs full scan on this specific link
  - "Copy clean URL" — strips tracking params
  - "Open in sandbox" — opens in isolated container tab
  - "Report link" — sends to community reputation service

### 6.3 Link Sanitizer (`link-sanitizer.js`) — 🟡 NEW

**Purpose:** Clean links before the user clicks them — remove tracking, affiliate injections, and redirect wrappers.

**Tracking Parameter Stripping:**
- Maintain a list of known tracking query parameters:
  - `utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content`
  - `fbclid`, `gclid`, `msclkid`, `ref`, `source`, `src`, `affiliate`
  - `mc_cid`, `mc_eid`, `_ga`, `_gl`, `yclid`, `igshid`
- Before navigation (or on click), strip these parameters from the URL
- Show user: "Original URL" vs "Cleaned URL"

**Affiliate Link Detection:**
- Compare link URL against known affiliate marker patterns (e.g., `/ref/`, `?tag=`, `?aff=`)

**Redirect Chain Expansion:**
- For known URL shorteners (bit.ly, t.co, ow.ly, etc.), pre-fetch the redirect chain
- Show the final destination before the user clicks

**User feedback:**
- Toggle in popup/options to enable/disable sanitization
- Badge showing "Sanitized X links on this page"

### 6.4 Edge Case Handler (`edge-case-handler.js`) — 🟡 NEW

**Purpose:** Handle advanced and edge-case attack surfaces that don't fit other modules.

**Coverage:**

| Attack Vector | Detection Strategy |
|--------------|-------------------|
| Cross-origin frame escape (`target="_top"`) | Check if link is inside an iframe and targets _top to navigate parent to different origin |
| SVG `<a>` element injection | Traverse `<svg>` elements for nested `<a>` tags (different namespace) |
| Custom element links | Use `customElements.get()` to check if registered elements have link-like behaviors or navigate on click |
| Unicode bidirectional override | Scan URL strings for U+202E (RIGHT-TO-LEFT OVERRIDE) and other bidi control characters that reorder text |
| Zero-width character injection | Check for U+200B, U+200C, U+200D in URL/domain strings |
| Same-domain user-generated content | If link points to same domain but path contains `/user/`, `/profile/`, `/comment/` — flag as potential UGC spam |
| Iframe with `srcdoc` attribute | `<iframe srcdoc="...">` can contain full HTML including links — scan srcdoc content |
| `<object>` / `<embed>` with `data` URL | These elements can navigate or load external content — flag if data attribute is an external URL |
| `window.open` from service worker | Monitor service worker messages that call `clients.openWindow()` to a suspicious URL |
| Navigation via `document.execCommand` | Legacy API that can trigger navigation in some browsers |

### 6.5 Link Density Analyzer (`link-density-analyzer.js`) — 🟢 NEW (Future)

**Purpose:** Detect SEO spam pages, link farms, and keyword-stuffed link sections.

**Metrics:**
- Total link count per page / per viewport
- Link-to-text ratio (percentage of clickable vs non-clickable content)
- Outbound link uniqueness (how many unique external domains are linked)
- Keyword frequency in link text (detect repetitive linking phrases)
- Contextual relevance (is the link text related to the destination page content?)

**Thresholds:**
- >100 links in a single viewport → flag as high density
- >50% of text is clickable → flag
- >20 outbound links to unrelated domains → flag

**User feedback:**
- Popup reports: "This page has 150 links to 35 different external domains"
- Optional: "Simplify page" mode that hides non-essential links

### 6.6 Link Health Checker (`link-health-pinger.js`) — 🟢 NEW (Future)

**Purpose:** Proactively check if known links are still safe (server-side validation with privacy).

**Operation:**
- After page load, queue outbound links for health check
- Send anonymized URL hashes to reputation service (opt-in)
- Or: do a lightweight HEAD request to check if destination is reachable (no content downloaded)
- Cache results per URL hash for 24 hours

**Privacy:**
- Only checks links the user is about to click (on hover or pre-navigation)
- Or: batch check all page links with randomized delays (to prevent timing correlation)
- Never send full URLs — only SHA-256 hashes of domain + path

---

## 7. Revised Development Timeline

| Phase | Focus | Key Deliverables | Original Est. | Revised Est. |
|-------|-------|------------------|---------------|--------------|
| **P0** | Scaffolding | `package.json`, build config, directory structure, linting | 1-2 days | 1-2 days |
| **P1a** | Core engine + Event Inspector | Redirect detector, popup blocker, **event-inspector.js**, click monitor | 5-7 days | 7-9 days |
| **P1b** | Hidden links + Link Verifier + UI | Hidden link scanner, link verifier, whitelist, statistics, popup, options | 3-5 days | 5-7 days |
| **P1c** | Polish & Test | Edge cases, unit tests, manual QA | 3-5 days | 4-6 days |
| **P1.5** | Enhanced protection | Expanded nav-guard, dynamic monitor, scam overlays, fake buttons, reputation, custom rules | 7-10 days | 10-14 days |
| **P2** | Link transparency | Protocol validator, transparency UI, link sanitizer, edge case handler | — | 8-12 days |
| **P3** | Advanced | Clipboard guard, shortener bypass, density analyzer, health checker (all standalone) | 10-15 days | 12-18 days |

---

## 8. Revised Permissions

```
manifest.json permissions (new additions in bold):

Required:
├── "tabs"                          # ✅ Existing
├── "webNavigation"                  # ✅ Existing
├── "storage"                        # ✅ Existing
├── "scripting"                      # ✅ Existing
├── "declarativeNetRequest"          # ✅ Existing
├── "menus"                          # 🔴 NEW — Right-click link inspector
├── "notifications"                  # 🟠 NEW — Scam overlay/redirect warnings
└── "contextualIdentities"          # 🟡 NEW — Container-based sandboxed browsing (v2.0)

Host permissions:
├── "<all_urls>"                     # ✅ Existing
│                                    # (Refine per-site as whitelist grows)
```

---

## 9. Testing Strategy (Expanded)

| Level | Tool | What to Test |
|-------|------|--------------|
| Unit | Jest | Pure logic: URL parsing, domain matching, homograph detection, event listener analysis, link classification |
| Integration | Jest + webextension-polyfill | Message passing, navigation flow, hidden link scanning pipeline, overlay detection |
| Manual | Firefox `about:debugging` | Real-world redirect scenarios, hidden link pages (test with invisible links), scam overlays |
| E2E | Selenium + geckodriver | Full extension lifecycle with test pages containing hidden links, event hijacks, homographs |

**New test pages to create in `tests/fixtures/`:**
- `hidden-links.html` — links with opacity:0, size:0, off-screen, color-match, z-index stacking
- `spoofed-links.html` — links with hover spoofing, href mutation, homograph domains
- `event-hijack.html` — links with click/mousedown listeners that redirect to different domains
- `scam-overlay.html` — fake virus warnings, fake CAPTCHA, fake close buttons
- `dynamic-injection.html` — links injected via JS after 1s, 5s, 10s delays

---

## 10. Engineering Principles (Expanded)

1. **Privacy by design** — No data collection without explicit opt-in. All processing local by default.
2. **Minimal permissions** — Only request host permissions for sites where protection is enabled.
3. **Defense in depth** — Content script + background worker + declarativeNetRequest layers.
4. **Edge case focus** — Handle iframes, data URIs, blob URLs, `javascript:` links, extension pages, Shadow DOM, SVGs.
5. **Performance first** — Avoid blocking the main thread; use `requestIdleCallback` for scans; debounce MutationObserver; use IndexedDB for large datasets; batch analytics writes.
6. **Testability** — Pure functions for core logic; dependency injection for browser APIs.
7. **Accessibility** — Popup and options pages follow WCAG 2.1 AA guidelines. Link risk badges have text alternatives.
8. **Graceful degradation** — If an API is not available (e.g., Firefox doesn't support `getEventListeners`), fall back to wrapper/hijack method rather than failing silently.
9. **User transparency** — Always show WHY a link was flagged, not just THAT it was flagged. Educate users about spam link tactics.

---

## 11. Risks & Mitigations (Expanded)

| Risk | Impact | Mitigation |
|------|--------|------------|
| Firefox Manifest V3 differences from Chrome | Extension may not work as expected | Test exclusively on Firefox; use Firefox-specific APIs |
| False positives (blocking legitimate redirects/links) | User frustration | Whitelist + "report safe" button; conservative heuristics initially; allow user to adjust sensitivity |
| Performance overhead from link scanning | Slower browsing, lag on heavy pages | Async scanning via `requestIdleCallback`; limit scan to viewport initially; IndexedDB caching; disable on whitelisted sites |
| Extension disabled by Firefox for policy violations | Distribution blocked | No ad-blocking; only protect users from malicious navigation; clear privacy policy |
| Limited API for event listener inspection | Cannot detect all hijacks | Use monkey-patch wrapper for `addEventListener` as fallback; accept that some hijacks will be undetectable |
| MutationObserver causing memory leaks | Tab memory growth | Disconnect observer when tab is hidden; throttle to 1 scan per 2 seconds max; disconnect after 60s of inactivity |
| Homograph detection false positives | Flagging legitimate international domains | Allowlist common non-Latin TLDs; use ICU-based language detection |
| Scam overlay text matching false positives | Flagging legitimate modals | Use weighted scoring (position + timing + text + behavior) not just keyword matching |

---

## 12. Immediate Next Steps (Updated)

1. Initialize npm project and install dependencies
2. Create `manifest.json` with all required permissions (including `menus`)
3. Build shared infrastructure: `constants.js`, `storage.js`, `messaging.js`, `link-classifier.js`, `event-analyzer.js`
4. Implement **Event Layer Inspector** (Phase 1a priority) — monkey-patch `addEventListener` in content script
5. Implement core click monitor + redirect detector (as originally planned)
6. Implement **Hidden Link Scanner** (Phase 1b priority) — DOM scan + computed styles analysis
7. Implement **Link Verifier** (Phase 1b priority) — hover spoofing, homograph, base tag detection
8. Wire up popup with basic stats + hidden link count + link risk summary
9. Run first manual test in Firefox `about:debugging`
- Use `browser.storage.sync` quotas (100KB) for whitelist + settings
- For larger data (reputation scores, rules), use Firefox Sync via `storage.sync` or custom account system

---


