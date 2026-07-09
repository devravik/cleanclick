# CleanClick — Task Breakdown

> Generated from DEVELOPMENT_PLAN.md | 2026-07-09

This document breaks down the entire project into actionable tasks and subtasks organized by phase. Each task is designed to be completed independently and tested before moving to the next.

---

## Phase 0 — Project Scaffolding

### T0.1 Initialize npm Project
- [ ] Create `package.json` with:
  - name: `cleanclick`
  - version: `0.1.0`
  - scripts: `build`, `dev`, `test`, `lint`
  - devDependencies: webpack, eslint, jest, webextension-polyfill
- [ ] Create `.gitignore` (node_modules, dist/, .webpack-cache)
- [ ] Create `.eslintrc.js` with Firefox WebExtensions environment
- [ ] Create `webpack.config.js` with multi-entry config for:
  - Background script
  - Content scripts (each as separate entry)
  - Popup (html + js + css)
  - Options page

### T0.2 Create Directory Structure
- [ ] Create all directories as specified in DEVELOPMENT_PLAN.md
- [ ] Create stub files for every module (empty exports)
- [ ] Create `src/manifest.json` with basic Firefox Manifest V3 structure
- [ ] Create `src/assets/icons/` with placeholder icons (16, 32, 48, 96, 128)
- [ ] Create `src/_locales/en/messages.json` with extension name/description

### T0.3 Create Test Infrastructure
- [ ] Set up Jest config (`jest.config.js`)
- [ ] Create `tests/fixtures/mock-data.js` with test URL sets and mock browser API stubs
- [ ] Create test HTML pages in `tests/fixtures/`:
  - `hidden-links.html`
  - `spoofed-links.html`
  - `event-hijack.html`
  - `scam-overlay.html`
  - `dynamic-injection.html`
- [ ] Set up webextension-polyfill for integration tests

### T0.4 Documentation & Config
- [ ] Create `CONTRIBUTING.md`
- [ ] Create `LICENSE` (MIT)
- [ ] Create `docs/architecture.md` with high-level architecture diagram
- [ ] Verify build: `npm run build` produces valid extension zip

---

## Phase 1a — Core Engine + Event Inspector (v1.0)

### T1a.1 Shared Infrastructure (`shared/`)
- [ ] **`constants.js`**:
  - Define suspicious domain list (initial set of ~100 known redirect domains)
  - Define timing thresholds (click-to-nav window: 100ms–10s)
  - Define CSS patterns for hidden link detection (opacity/position/size thresholds)
  - Define risk score thresholds (safe: 0-20, suspicious: 21-60, dangerous: 61-100)
  - Define event types to monitor (`click`, `mousedown`, `mouseup`, `auxclick`, `touchstart`, `touchend`)
- [ ] **`storage.js`**:
  - Implement `get(key, default)` / `set(key, value)` / `remove(key)` wrapper
  - Implement schema versioning with auto-migration
  - Implement storage areas: `local` (stats, rules) and `sync` (whitelist, settings)
  - Add change listeners for cross-context sync
- [ ] **`messaging.js`**:
  - Define message type constants (20+ types for all module interactions)
  - Implement `sendMessage(type, payload)` → Promise
  - Implement `onMessage(type, handler)` registration
  - Implement port-based long-lived connections for content ↔ background
  - Error handling: timeout after 5s, retry on disconnect
- [ ] **`utils.js`**:
  - `parseURL(url)` → `{ protocol, domain, path, query, hash }`
  - `normalizeURL(url)` — decode, lowercase domain, remove fragment
  - `getDomainParts(url)` → `{ subdomain, domain, tld }`
  - `isSameDomain(url1, url2)` — handles www vs non-www
  - `getRedirectChain(url)` — fetch HEAD requests to follow redirects
  - `debounce(fn, ms)` and `throttle(fn, ms)` utilities
- [ ] **`link-classifier.js`** — 🔴 NEW:
  - Implement risk scoring pipeline: normalize → check homographs → compare text vs href → check domain reputation → output score
  - Implement `classifyLink(element)` → `{ riskScore, riskLevel, reasons[] }`
  - Implement `classifyURL(url)` for out-of-DOM classification
  - Maintain local cache of classified URLs to avoid re-scanning
- [ ] **`event-analyzer.js`** — 🔴 NEW:
  - Implement function body inspection logic to detect navigation patterns in listener callbacks
  - Detect patterns: `window.location.href =`, `location.assign()`, `window.open()`, `setTimeout(() => location=...)`
  - Implement `analyzeListener(fn)` → `{ isHijack: boolean, targets: string[], confidence: number }`
  - Handle minified/obfuscated function detection (basic heuristic)

### T1a.2 Event Layer Inspector (`content-scripts/event-inspector.js`) — 🔴 NEW
- [ ] **Monkey-patch `EventTarget.prototype.addEventListener`**:
  - Wrap native addEventListener to track all registrations in a `WeakMap<Element, Map<EventType, Listener[]>>`
  - Preserve original behavior: wrapped function calls original after tracking
  - Handle `options` parameter (capture, once, passive)
  - Handle `removeEventListener` — remove from shadow registry
- [ ] **Implement per-element listener query**:
  - `getListenersForElement(element)` → `{ type, fn, options }[]`
  - Filter by relevant event types (`click`, `mousedown`, `auxclick`, etc.)
- [ ] **Analyze listeners for hijacking**:
  - For each tracked listener, extract function source via `.toString()`
  - Send function source to `event-analyzer.js` for pattern matching
  - Flag elements where any listener matches hijack patterns
- [ ] **Report to background**:
  - On page load: scan all existing elements with event listeners (if possible)
  - On new listener added: analyze immediately
  - Send `{ tabId, elementSelector, href, listenerType, hijackTarget, confidence }` to background
- [ ] **Edge cases**:
  - Cross-origin iframes: can't inspect listeners in cross-origin frames — skip silently
  - Native functions: `.toString()` returns `function () { [native code] }` — skip
  - Minified code: try to match patterns on minified source; lower confidence score
  - Memory: limit shadow registry to 1000 entries per page; evict oldest

### T1a.3 Click Monitor (`content-scripts/click-monitor.js`)
- [ ] Record click events on `<a>` elements:
  - Capture: `href`, `linkText`, `event.clientX/Y`, `timestamp`, `tabId`, `frameId`
  - Capture: `ctrlKey`, `shiftKey`, `metaKey`, `button` (left/middle/right)
- [ ] Send click context to background via messaging (port-based)
- [ ] Handle special clicks: middle-click (auxclick), Ctrl+click, drag
- [ ] Handle clicks on parent elements where `<a>` is a descendant (event delegation)
- [ ] Handle `<area>` tags inside image maps
- [ ] If event inspector flagged element as hijacked: show in-page warning banner before navigation proceeds

### T1a.4 Redirect Detector (`background/redirect-detector.js`)
- [ ] **Navigation monitoring setup**:
  - Listen to `webNavigation.onCommitted` — captures all navigations
  - Listen to `webNavigation.onCreatedNavigationTarget` — captures new tabs/windows
  - Listen to `webNavigation.onErrorOccurred` — captures blocked/failed navigations
- [ ] **Click-to-navigation correlation**:
  - Maintain a map: `tabId → { clickContext, timestamp }` (expire after 30s)
  - On navigation event, match against recent click context in same tab
  - Calculate: was there a user click? Did the navigation match the intended href?
- [ ] **Redirect chain tracking**:
  - Track sequential navigations in the same tab within 2s window
  - Count redirect hops; flag chains >3 hops
- [ ] **Suspicious detection heuristics**:
  - Origin vs destination domain mismatch (no click context or hijacked)
  - Rapid redirects (>3 in <2s)
  - Focus stealing (new tab opened in background, page gains focus then immediately redirects)
  - Timing anomaly (<100ms or >30s since click)
  - Event inspector flagged (from T1a.2)
- [ ] **Blocking actions**:
  - Close tab: `browser.tabs.remove(tabId)`
  - Focus original: `browser.tabs.update(originalTabId, { active: true })`
  - Show notification: `browser.notifications.create()` with details
  - Log to statistics: increment blocked counter

### T1a.5 Popup Blocker (`content-scripts/popup-blocker.js`)
- [ ] **Override `window.open`**:
  - Monkey-patch `window.open` in content script
  - Check destination against suspicious criteria before allowing
  - Return `null` for blocked popups
  - Log blocked popup to background
- [ ] **Suspicious popup criteria**:
  - No user gesture (not inside trusted event handler)
  - Destination domain different from origin by >2 TLD levels
  - URL matches known ad/malware pattern (regex-based)
  - Called from `setTimeout`/`setInterval` (delayed popup)
- [ ] **Post-open popup closure**:
  - Listen for new tabs with `tabs.onCreated`
  - Check if tab was opened without user gesture
  - Close unwanted popup tabs within 500ms

### T1a.6 Event Coordinator (`background/event-coordinator.js`) — 🔴 NEW
- [ ] Receive event analysis reports from content scripts
- [ ] Maintain per-tab state: `Map<tabId, { flaggedElements[], hijackedCount }>`
- [ ] Aggregate statistics: total hijacked elements detected across all tabs
- [ ] Forward critical flags to redirect detector (for navigational correlation)
- [ ] Handle tab close: clean up per-tab state

---

## Phase 1b — Hidden Links, Link Verification & UI (v1.0)

### T1b.1 Hidden Link Scanner (`content-scripts/hidden-link-scanner.js`) — 🔴 NEW
- [ ] **Core scan function**:
  - Query all `<a>`, `<area>`, `<button>` elements in document
  - For each element, compute: `getComputedStyle(el)`, `el.offsetWidth/Height`, `el.getBoundingClientRect()`
  - Check against 9 detection vectors (see DEVELOPMENT_PLAN §3.5)
  - Return array of objects: `{ element, tagName, href, hidingMethod, coordinates, rect }`
- [ ] **Transparency overlay detection**:
  - Find all `position: fixed/absolute` elements covering >60% of viewport
  - Check computed opacity; if <0.01 → flag as clickjacking overlay
- [ ] **Z-index stacking detection**:
  - Group all `<a>` elements by their approximate center coordinates (grid: 50x50px cells)
  - If multiple elements share same cell, sort by z-index
  - Flag all but the topmost element as "potentially hidden behind higher z-index"
- [ ] **Shadow DOM traversal**:
  - If element has `shadowRoot`, recursively scan inside
  - Handle open shadow roots only; closed shadow roots log a warning
- [ ] **Report results**:
  - Send `{ tabId, hiddenLinksCount, hiddenLinks[] }` to background
  - Update toolbar badge: show hidden link count (e.g., "3" in red)
- [ ] **Reveal feature**:
  - On popup action "Reveal hidden links", inject CSS overlay:
    - Add `outline: 3px dashed red` to all hidden links
    - Add `background: rgba(255,0,0,0.1)` to transparent overlays
    - Add `z-index: 2147483647 !important` to make clickable
  - Toggle mode: reveal / hide

### T1b.2 Link Verifier (`content-scripts/link-verifier.js`) — 🔴 NEW
- [ ] **A. Hover Spoofing Detection**:
  - On `mouseenter`/`mouseover` on `<a>`: record `element.href` at that moment
  - On `click`: record `element.href` again; compare
  - If href changed between hover and click → flag as "mutated href"
  - Also check: does any parent element have an event listener that modifies href on mousedown?
- [ ] **B. Link Text vs Href Discrepancy**:
  - On page load, for each `<a>` with non-empty text:
    - Extract domain from text content (regex: `https?://[^\s]+` or `[a-z0-9.-]+\.[a-z]{2,}`)
    - Compare extracted domain vs `new URL(element.href).hostname`
    - If different → flag as "text mismatch"
    - If TLD differs → flag with higher severity
- [ ] **C. Punycode/IDN Homograph Detection**:
  - Load confusable character table (built-in JSON mapping: ~200 lookalikes)
  - For each domain, normalize with `String.prototype.normalize('NFKC')`
  - Check each character against confusables table
  - Flag if domain mixes scripts (e.g., Latin + Cyrillic)
  - Check against popular domains list (top 500) with Levenshtein distance ≤ 1
- [ ] **D. Base Tag Hijacking Detection**:
  - On page load, check for `<base>` element
  - If `<base href>` origin differs from `document.location.origin` → CRITICAL flag
  - Re-scan all relative URLs in the page; all are potentially hijacked
- [ ] **E. JavaScript/Data/Blob URI Detection**:
  - Check `element.protocol` for each link
  - Flag `javascript:`, `data:text/html`, `blob:` protocols
  - For blob URLs: check if blob was created by same-origin script (track via monkey-patch)
- [ ] **F. Subdomain Confusion Detection**:
  - Parse domain into `[subdomain(s).[domain].[tld]]`
  - Check if any subdomain label matches a known brand name (list of 200 brands)
  - Example: `paypal.security.fake-site.com` → subdomain "paypal" ≠ domain "fake-site"
  - Flag with "brand impersonation" reason
- [ ] **Integration with link-classifier.js**:
  - Send all findings to link-classifier for risk scoring
  - Update per-link risk score based on verification results

### T1b.3 Website Whitelist (`background/whitelist-manager.js`)
- [ ] **CRUD operations**:
  - `addDomain(domain)` — validate format, prevent duplicates
  - `removeDomain(domain)`
  - `isWhitelisted(url)` — check exact match + pattern match
  - `getAll()` — return sorted list
- [ ] **Storage**: use `browser.storage.sync` for cross-device sync
- [ ] **Pattern matching**:
  - Exact: `example.com`
  - Wildcard: `*.example.com` (all subdomains)
  - Regex: `/^https?:\/\/(.*\.)?example\.com/` (v1.5)
- [ ] **Integration with other modules**:
  - Hidden link scanner: whitelisted domains still scan but don't block
  - Redirect detector: whitelisted domains bypass blocking
  - Statistics: log whitelisted domain visits separately

### T1b.4 Statistics (`background/statistics.js`)
- [ ] **Counters** (persist to `browser.storage.local`):
  - `redirectsBlocked` — total blocked redirects
  - `popupsPrevented` — total blocked popups
  - `suspiciousDomainsDetected` — unique suspicious domains encountered
  - `hiddenLinksFound` — total hidden links detected
  - `hijackedElementsFlagged` — total event-hijacked elements
  - `sessionsProtected` — increment on each new tab open
- [ ] **Daily rollups**:
  - Store daily stats: `{ date: '2026-07-09', counts: {...} }`
  - Keep 90 days of history; auto-purge older entries
- [ ] **Session tracking**:
  - Track `sessionStart` timestamp on background worker start
  - Calculate session duration, pages visited, per-page stats
- [ ] **Reset functionality**:
  - `resetAll()` — clear all counters
  - `resetDaily()` — clear today's stats only

### T1b.5 Popup UI (`popup/`)
- [ ] **`index.html`**:
  - Design matching Firefox Proton/Photon guidelines (clean, rounded, compact)
  - Sections: (1) Protection status, (2) Toggle, (3) Stats, (4) Link scan summary, (5) Settings
  - Min-width: 320px, max-width: 400px
- [ ] **`popup.css`**:
  - Use Firefox's `system-ui` font stack
  - Dark/light mode support via `prefers-color-scheme`
  - Minimalist icons (SVG inline or unicode symbols)
- [ ] **`popup.js`** (controller):
  - On open: request current tab info, protection state, stats, link scan results
  - Bind toggle button to enable/disable protection on current domain
  - Update stats display with animated counters
  - Show "X hidden links found" with reveal button
  - Show link scan summary (safe/suspicious/dangerous counts)
  - "Settings" link opens `browser.runtime.openOptionsPage()`
- [ ] **`components/stats-panel.js`**:
  - Display 4-6 stat counters with icons
  - Use CSS bar chart for daily comparison
  - Animate number transitions
- [ ] **`components/whitelist-panel.js`**:
  - Show current domain with toggle switch
  - Show "Whitelisted domains" count with link to full list in options
- [ ] **`components/protection-toggle.js`**:
  - Toggle switch component
  - States: enabled (green), disabled (gray), error (red)
  - Shows "Protecting this site" / "Protection off for this site"
- [ ] **`components/link-scanner-report.js`** — 🟠 NEW:
  - Summary: "Scanned 42 links — 3 hidden, 1 suspicious, 0 dangerous"
  - Expandable list of hidden/suspicious links with href and reason
  - "Reveal hidden links" toggle button
  - "Scan page now" manual trigger button

### T1b.6 Options Page (`options/`)
- [ ] **`index.html`**:
  - Full-width options page with tabbed navigation
  - Tabs: General, Whitelist, Statistics, Rules (future), About
  - Firefox Proton-compliant styling
- [ ] **`options.js`**:
  - Load settings from storage on open
  - Whitelist management: add/remove domains, bulk import/export (JSON)
  - Reset statistics with confirmation dialog
  - Export/Import all settings (JSON file)
  - Link preview settings (show badges, show tooltips, confirmation level)
- [ ] **`options.css`**:
  - System font stack, responsive layout
  - Dark mode support
- [ ] **`components/whitelist-manager.js`**:
  - Text input + "Add" button
  - List with delete buttons
  - Bulk import: paste comma/line-separated domains
  - Export: download JSON file
- [ ] **`components/custom-rules-editor.js`** (placeholder for v1.5):
  - UI for rule table when rules module is implemented
  - Placeholder message: "Custom rules coming in v1.5"
- [ ] **`components/link-preview-settings.js`** — 🟠 NEW:
  - "Show risk badges on links" checkbox
  - "Enable hover tooltips" checkbox
  - "Click confirmation for suspicious links" dropdown (never/suspicious only/all)
  - "Auto-reveal hidden links" checkbox

---

## Phase 1c — Polish & Test (v1.0)

### T1c.1 Unit Tests
- [ ] `shared/constants.js` — test threshold values, domain list integrity
- [ ] `shared/storage.js` — test get/set/remove, schema migration
- [ ] `shared/messaging.js` — test message routing, timeout, error handling
- [ ] `shared/utils.js` — test URL parsing, normalization, domain extraction, debounce
- [ ] `shared/link-classifier.js` — test risk scoring with various URL types
- [ ] `shared/event-analyzer.js` — test listener pattern detection with known hijack code
- [ ] `background/redirect-detector.js` — test heuristic logic in isolation (mock browser APIs)
- [ ] `background/whitelist-manager.js` — test CRUD, pattern matching, sync
- [ ] `background/statistics.js` — test counter increment, daily rollup, reset
- [ ] `content-scripts/event-inspector.js` — test monkey-patch, listener tracking, analysis
- [ ] `content-scripts/hidden-link-scanner.js` — test all 9 detection vectors with DOM mock
- [ ] `content-scripts/link-verifier.js` — test homograph detection, text mismatch, base tag

### T1c.2 Integration Tests
- [ ] **Navigation flow test**: simulated click → event recorded → redirect detected → blocked
- [ ] **Event inspector flow test**: monkey-patch addEventListener → track → analyze → flag
- [ ] **Hidden link scan flow test**: DOM with hidden links → scan → detect → report → reveal
- [ ] **Link verification flow test**: DOM with spoofed links → verify → flag → classify
- [ ] **Whitelist integration test**: whitelist domain → click hijack → no block
- [ ] **Messaging round-trip test**: popup → message → background → response → popup

### T1c.3 Manual QA Checklist
- [ ] **Install**: Load as temporary extension in Firefox `about:debugging`
- [ ] **Basic navigation**: Visit 5 normal sites — no false positives
- [ ] **Hidden links test**: Open `tests/fixtures/hidden-links.html` — all 9 vectors detected
- [ ] **Spoofed links test**: Open `tests/fixtures/spoofed-links.html` — all spoof types flagged
- [ ] **Event hijack test**: Open `tests/fixtures/event-hijack.html` — hijacked listeners detected
- [ ] **Popup**: Open popup on each test page — correct stats, toggle works
- [ ] **Whitelist**: Add current domain to whitelist — protection disabled
- [ ] **Options**: Open options page — whitelist CRUD works, export/import works
- [ ] **Performance**: Open a page with 1000+ links — scan completes within 2s
- [ ] **Memory**: Load 10 tabs simultaneously — extension doesn't crash

### T1c.4 Edge Case Handling
- [ ] **Cross-origin iframes**: Links inside iframes from different origins — handled gracefully
- [ ] **data: URIs**: Links with `data:text/html` content — flagged
- [ ] **blob: URIs**: Dynamically created blob URLs — detected
- [ ] **javascript: URIs**: `javascript:void(0)` with onclick — detected
- [ ] **Empty href**: `<a href="">` (self-link) — not flagged
- [ ] **Hash links**: `<a href="#section">` — not flagged
- [ ] **Download links**: `<a download>` — special handling (not spam)
- [ ] **Mailto links**: `<a href="mailto:...">` — not flagged by redirect detector
- [ ] **Extension pages**: `moz-extension://` links — skipped
- [ ] **About pages**: `about:blank`, `about:config` — skipped
- [ ] **No href**: `<a>` without href attribute — skipped

---

## Phase 1.5 — Enhanced Protection (v1.5 Milestone)

### T1.5.1 Expanded Navigation Guard (`content-scripts/navigation-guard.js`)
- [ ] **Form submission hijacking detection**:
  - Override `HTMLFormElement.prototype.submit` or use `beforesubmit` event
  - Compare `form.action` against trusted origins (page origin + whitelist)
  - If action is external → show warning with destination URL
  - Allow user to cancel submission or proceed
- [ ] **Meta refresh detection**:
  - Scan for `<meta http-equiv="refresh">` tags on page load
  - Monitor for dynamically added meta refresh tags (via MutationObserver)
  - If auto-redirect points to different domain → intercept and show overlay
  - Overlay: "This page wants to redirect you to [URL]" with countdown + cancel button
- [ ] **Service worker registration monitoring**:
  - Monkey-patch `navigator.serviceWorker.register()`
  - Log all registration attempts with SW script URL
  - If SW script is on different domain → warn user
  - Option to unregister suspicious SWs: `registration.unregister()`
- [ ] **History API abuse detection**:
  - Monkey-patch `history.pushState` and `history.replaceState`
  - If state URL changes to different origin → warn "URL was changed without navigation"
  - Can user undo? Show "Back to safe page" button
- [ ] **PostMessage origin validation**:
  - Monkey-patch `window.postMessage` and track `message` event listeners
  - If `location.href` changes within a `message` handler from untrusted origin → flag
  - Maintain allowed origins list (current page origin only by default)

### T1.5.2 Dynamic Content Monitor (`content-scripts/dynamic-link-watcher.js`) — 🟠 NEW
- [ ] **MutationObserver setup**:
  - Observe `document.body` with `{ childList: true, subtree: true, attributes: true }`
  - Filter mutations to relevant node additions and attribute changes
- [ ] **New element scanning**:
  - On mutation batch, scan added nodes for `<a>`, `<form>`, `<area>`, `<button>`
  - Also scan iframes (possible ad injection)
  - Run hidden-link-scanner and link-verifier on new elements
- [ ] **Attribute change detection**:
  - Monitor `href`, `action`, `data` attribute changes on existing elements
  - If an element's href changes after initial scan → flag as "mutated"
- [ ] **Text node URL detection**:
  - Scan new text nodes for URLs that could become auto-linked
  - Some pages convert text URLs to links after load
- [ ] **Shadow DOM monitoring**:
  - On each mutation, check if added nodes have `shadowRoot`
  - If so, observe shadow DOM mutations too
- [ ] **Performance safeguards**:
  - Debounce: process mutations max every 500ms
  - Batch: accumulate mutations and process in one pass
  - Limit: disconnect observer after 60s of tab inactivity
  - Cap: maximum 2000 tracked elements per page

### T1.5.3 Scam Overlay Detector (`content-scripts/scam-overlay-detector.js`) — 🟠 NEW
- [ ] **Overlay detection**:
  - MutationObserver watching for new `fixed` or `absolute` positioned elements
  - Check if element covers >60% of viewport
  - Check if z-index > 1000
  - Check if appeared within last 2s (sudden appearance)
- [ ] **Scam text analysis**:
  - Extract text content of suspected overlay
  - Match against scam phrase patterns (20+ patterns, regex-based)
  - Weighted scoring: more matches = higher scam confidence
  - Language detection to avoid false positives on non-English sites
- [ ] **Fake close button detection**:
  - Find all buttons/links within the overlay
  - For each, check click handler (via event-inspector.js integration)
  - If labeled "X", "Close", "Cancel" but handler redirects → flag
  - If clicking overlay background triggers navigation → flag
- [ ] **User response**:
  - Show Firefox notification: "Suspicious overlay detected"
  - Offer "Remove overlay" button that: `element.remove()` the overlay from DOM
  - Log overlay URL, scam type, and domain to statistics
  - Add domain to temporary watchlist (auto-clears after 24h)

### T1.5.4 Fake Download Button Detection (`content-scripts/fake-button-detector.js`)
- [ ] **DOM scanning for download elements**:
  - Find elements with: `download` attribute, class names containing "download"/"dl"/"get"
  - Find elements with: `aria-label` containing "download"
  - Find elements near common ad placements (above fold, near video/content area)
- [ ] **Legitimacy scoring**:
  - Positive signals: `download` attribute, `Content-Disposition` response header, same-origin
  - Negative signals: ad-related class names, iframe-wrapped, different-domain href
  - Score: +1 for each positive, -1 for each negative; threshold >2 = legitimate
- [ ] **UI integration**:
  - Overlay green checkmark badge on legitimate download buttons
  - Overlay red warning triangle on suspected fake buttons
  - Show tooltip on hover: "This appears to be a legitimate download" / "This may be a fake download button"

### T1.5.5 Redirect Reputation Scoring (`background/reputation.js`)
- [ ] **Local scoring database** (IndexedDB):
  - Schema: `{ domain, score, redirectCount, lastSeen, userFeedback, knownPatterns[] }`
  - Store in IndexedDB for >5MB capacity (vs storage.local 5MB limit)
  - Implement get/update/query operations
- [ ] **Scoring algorithm**:
  - Base score: 50 (neutral)
  - +10 per intermediary redirect in chain
  - +20 if redirect matches known malicious pattern (e.g., `adserver → tracker → malware`)
  - -10 if user marked as safe
  - +30 if community-reported as malicious (from cloud service in v2.0)
  - Max score: 100 (malicious), Min: 0 (trusted)
- [ ] **Domain classification**:
  - Green (0-30): Trusted — no intervention
  - Yellow (31-69): Suspicious — warn user
  - Red (70-100): Malicious — block automatically
- [ ] **User feedback integration**:
  - After blocked redirect, ask: "Was this redirect malicious?" (Yes / No / Not sure)
  - Feedback updates the score immediately
  - Provide "Report to community" button (v2.0)

### T1.5.6 Custom Blocking Rules (`background/rules-engine.js`)
- [ ] **Rule schema**:
  ```js
  {
    id: string,
    name: string,
    pattern: string,       // glob or regex pattern
    patternType: 'glob' | 'regex' | 'domain',
    action: 'block' | 'warn' | 'allow',
    enabled: boolean,
    createdAt: timestamp,
    hitCount: number
  }
  ```
- [ ] **Rule matching engine**:
  - Test URL against all enabled rules
  - Glob: convert to regex, match against URL
  - Regex: test directly
  - Domain: exact match + subdomain wildcard
  - Rules ordered by specificity (most specific first); first match wins
- [ ] **Rule editor UI** (in options page):
  - Table view: rule name, pattern, action, enabled toggle, hit count
  - Add/edit modal: name, pattern, type dropdown, action dropdown
  - Delete with confirmation
  - Import/Export rules (JSON)
  - Test rule against sample URL
- [ ] **Storage**: `browser.storage.local` (rules can be large)

---

## Phase 2 — Link Transparency (v2.0)

### T2.1 Protocol Link Validator (`content-scripts/protocol-link-validator.js`) — 🟡 NEW
- [ ] **Protocol categorization**:
  - Scan all links and categorize by protocol scheme
  - Categories: `http/https` (standard), `tel:`, `sms:`, `mailto:`, `intent://`, `facetime:`, `skype:`, `whatsapp:`, `tg:`, `viber:`, other
- [ ] **tel: validation**:
  - Parse phone number from `tel:+1234567890`
  - Check against premium-rate number database (heuristic: area codes 900, 976, etc.)
  - Flag premium-rate numbers with warning
- [ ] **sms: validation**:
  - Parse body parameter; check for keywords like "subscribe", "join", "premium"
  - Flag if body appears to initiate paid subscription
- [ ] **External app launch warning**:
  - For `intent://`, `facetime:`, `skype:`, `whatsapp:` links
  - Show confirmation dialog: "This link will open an external application"
  - Display: app name, destination, "Remember my choice for this domain"
- [ ] **mailto: harvesting detection**:
  - Check if mailto link is visible vs hidden (see hidden-link-scanner)
  - Flag hidden mailto links as potential email harvesting
- [ ] **Allowlist management**:
  - Store trusted protocol+domain pairs: `{ protocol: 'tel', domain: 'example.com' }`
  - Skip confirmation for allowlisted pairs

### T2.2 Link Transparency UI (`content-scripts/link-transparency-ui.js`) — 🟠 NEW
- [ ] **A. Risk Badge Overlay**:
  - After classification scan, inject small colored dots on links
  - Positioning: top-right corner of each `<a>` element
  - Dot colors: 🟢 green, 🟡 yellow, 🔴 red, ⚪ gray
  - Toggle: always visible / show on hover only (from options)
  - CSS: `position: relative` on target, badge uses `position: absolute`
- [ ] **B. Custom Tooltip Component**:
  - Create a floating `div` that appears on hover over any link
  - Content: favicon of destination, full URL, risk score bar (0-100)
  - Sections: "Why this score" (list of reasons), redirect chain length
  - Quick action buttons: "Copy clean URL", "Report as spam", "Whitelist domain"
  - Styling: dark background, rounded corners, shadow, max-width 400px
- [ ] **C. Click Confirmation Dialogs**:
  - **Medium risk (yellow)**: Show bar at top of page (non-blocking):
    - "This link goes to [domain]. It appears suspicious. [Continue] [Cancel]"
    - Auto-dismiss after 5s (default: continue)
  - **High risk (red)**: Show modal dialog (blocking):
    - "⚠️ Dangerous link detected"
    - "Destination: [full URL]"
    - Reasons list (homograph, hijacked, known malware)
    - Buttons: "Go back (safe)" / "Proceed anyway" / "Report"
  - Modal is HTML overlay within page (not `alert()` which can't style)
- [ ] **D. Right-Click Link Inspector**:
  - Register context menu via `browser.menus.create()`
  - Menu items:
    - "Check link safety" — runs full scan, shows result in popup
    - "Copy clean URL" — strips tracking params, copies to clipboard
    - "Open in container tab" — opens in separate Firefox container
    - "Report link as spam" — sends to community service
  - Context: `link` only
  - Handle menu item clicks in background script

### T2.3 Link Sanitizer (`content-scripts/link-sanitizer.js`) — 🟡 NEW
- [ ] **Tracking parameter stripping**:
  - Maintain blocklist of tracking params (50+ entries)
  - Before navigation: parse query string, remove known tracking params
  - Reconstruct clean URL without tracking params
  - Show comparison: "Original" (strikethrough) vs "Cleaned" (green)
- [ ] **Affiliate link detection**:
  - Check URL for affiliate markers: `/ref/`, `?tag=`, `?affiliate=`, `?ref=`
  - Check known affiliate domains (skimlinks.com, viglink.com, etc.)
  - Flag with "This link contains affiliate tracking"
  - Option to strip affiliate params (if possible)
- [ ] **Redirect chain expansion**:
  - For URLs matching known shortener domains (30+ domains):
    - `bit.ly`, `t.co`, `ow.ly`, `tinyurl.com`, `shorturl.at`, `is.gd`, etc.
  - Fetch HEAD request to follow redirect chain (max 10 hops)
  - Show final destination URL before user clicks
  - Cache expansion results per URL for 1 hour
- [ ] **Privacy note**: HEAD requests are made directly from content script
  - No URL sent to third-party servers
  - User can disable pre-fetch in options

### T2.4 Edge Case Handler (`content-scripts/edge-case-handler.js`) — 🟡 NEW
- [ ] **Cross-origin frame escape detection**:
  - Check if `window !== window.top` (inside iframe)
  - For links with `target="_top"` or `target="_parent"`: check if href origin differs from top origin
  - If different → warn: "This link will navigate the entire page to a different site"
- [ ] **SVG `<a>` element scanning**:
  - Query `<svg>` elements for `<a xlink:href="...">` or `<a href="...">`
  - SVG `<a>` elements are in a different namespace but can navigate
  - Run link-verifier and hidden-link-scanner on these too
- [ ] **Custom element link detection**:
  - Use `customElements.whenDefined()` + `customElements.get()`
  - If a custom element has a `href` attribute or navigates on click → flag
  - Register observed attributes for custom elements with link behavior
- [ ] **Unicode bidirectional override detection**:
  - Scan URL strings for U+202E (RIGHT-TO-LEFT OVERRIDE) and related chars
  - These can make URLs visually reorder (e.g., `example.com/evil` appears as `example.com/live`)
  - Flag and show the true URL with character positions highlighted
- [ ] **Zero-width character detection**:
  - Scan for U+200B (ZERO WIDTH SPACE), U+200C, U+200D in domain names
  - These can be used for domain squatting without visible difference
  - Flag with "Invisible characters detected in domain"
- [ ] **Same-domain UGC detection**:
  - If link points to same domain but path contains: `/user/`, `/profile/`, `/comment/`, `/forum/`
  - Flag as "User-generated content link — may contain spam"
  - Lower severity than cross-domain spam but still highlighted
- [ ] **Iframe srcdoc scanning**:
  - For `<iframe srcdoc="...">`, parse the srcdoc HTML content
  - Extract links from srcdoc content and run standard checks
- [ ] **Object/embed data URL checks**:
  - For `<object data="...">` and `<embed src="...">`
  - If data/src is an external URL and not a media file → flag
- [ ] **`clients.openWindow` from SW monitoring**:
  - Monkey-patch `clients.openWindow` in monitored service workers
  - Log URLs opened via this API
  - Flag if opened URL is suspicious

---

## Phase 3 — Advanced Features (v2.0+)

### T3.1 Cloud Reputation Service (Backend)
- [ ] **Backend setup** (separate repo `cleanclick-cloud`):
  - Node.js/Express or FastAPI server
  - Database: PostgreSQL or SQLite for simple deployment
  - API endpoints:
    - `POST /api/v1/reputation` — submit URL hash, get reputation score
    - `POST /api/v1/report` — submit user report (anonymous)
    - `GET /api/v1/blacklist` — download recent blacklist hashes (periodic sync)
  - Rate limiting: 100 req/min per IP
- [ ] **Extension integration**:
  - `POST` URL hashes (SHA-256) to reputation endpoint
  - Cache responses locally for 24h
  - Only active when user opts in (settings toggle)
  - No PII sent — only hashed URL components

### T3.2 Community Reporting
- [ ] **Report flow**:
  - User clicks "Report link as spam" (from context menu or tooltip)
  - Collect: hashed URL, redirect chain hash, timestamp, user label (spam/safe)
  - Send to `POST /api/v1/report`
  - Show confirmation: "Thank you. This report is anonymous."
- [ ] **Feedback loop**:
  - Periodically fetch updated reputation scores from cloud
  - Merge with local reputation database
  - Frequency: every 6 hours (configurable)

### T3.3 AI-Powered Fake Button Detection
- [ ] **Model preparation**:
  - Collect training data: screenshots + DOM structure of real vs fake download buttons
  - Train lightweight classification model (TensorFlow.js or ONNX)
  - Target: <5MB model size, <100ms inference time
- [ ] **Extension integration**:
  - Use TensorFlow.js or ONNX runtime for Firefox
  - Load model on extension start (if enabled)
  - Pass button screenshot + DOM features to model
  - Fall back to heuristic detection if model not loaded or slow

### T3.4 Scam Website Detection
- [ ] **URL analysis**:
  - Typosquatting: Levenshtein distance to top 1000 domains
  - Suspicious TLDs: flag uncommon TLDs (`.xyz`, `.top`, `.work`, `.gq`, etc.)
  - DOM similarity: compare page DOM structure against known phishing pages
- [ ] **Content analysis**:
  - Scan page content for scam language patterns (advanced NLP)
  - Check for hidden text / keyword stuffing
  - Compare page content against community-reported scam signatures

### T3.5 Clipboard Hijacking Protection
- [ ] **Clipboard event monitoring**:
  - Listen for `copy` / `cut` events on `document`
  - Also monitor for `clipboard.write()` and `clipboard.writeText()` calls
  - Maintain a snapshot of clipboard content before untrusted writes
- [ ] **Detection**:
  - If clipboard content was changed by a script not triggered by user gesture
  - If clipboard contains cryptocurrency addresses and was silently modified
  - If clipboard content is a URL redirecting to known spam domain
- [ ] **User action**:
  - Show notification: "A script modified your clipboard"
  - Offer "Restore previous clipboard" action

### T3.6 URL Shortener Bypass
- [ ] **Shortener detection**:
  - Maintain list of 50+ known URL shorteners
  - Detect shortened URLs in links, text, and clipboard
- [ ] **Expansion**:
  - Fetch HEAD request to expand URL (follow redirects, max 10 hops)
  - Show final destination before navigation
  - Option to automatically expand shortened URLs
- [ ] **Integration with link-verifier**:
  - If final destination is suspicious, flag the short URL as risky

### T3.7 Cross-Device Synchronization
- [ ] **Sync strategy**:
  - Use `browser.storage.sync` for small data (whitelist, settings): ~100KB quota
  - Use Firefox Sync API for larger data (custom rules, reputation): separate quota
  - Conflict resolution: last-write-wins with timestamp comparison
- [ ] **Data to sync**:
  - Whitelist (domains + patterns)
  - Settings (link transparency preferences, sanitization toggles)
  - Custom rules (if small enough)
  - Local reputation scores (if sync space allows)

### T3.8 Link Density Analyzer (`content-scripts/link-density-analyzer.js`) — 🟢 NEW
- [ ] **Metrics collection**:
  - Count total `<a>` elements in page
  - Count unique external domains linked
  - Calculate link-to-text ratio (total link text length / total text length)
  - Extract link text keywords and check for repetition
- [ ] **Threshold analysis**:
  - >100 links in viewport → high density flag
  - >50% link-to-text ratio → flag
  - >20 outbound to unrelated domains → flag
  - Keyword frequency >3 same anchor text → keyword stuffing flag
- [ ] **User feedback**:
  - Popup section: "This page has 150 links to 35 domains"
  - Warning if density exceeds thresholds
  - "Simplify page" option: hide non-essential links (CSS `display: none`)

### T3.9 Link Health Checker (`background/link-health-pinger.js`) — 🟢 NEW
- [ ] **Queue management**:
  - After page load, collect outbound link URLs
  - Add to processing queue with priority (visible links first)
  - Process queue with max 5 concurrent requests
- [ ] **Health check**:
  - Send HEAD request to each URL (no content downloaded)
  - Check HTTP status code (200=ok, 4xx/5xx=problem, timeout=unreachable)
  - Check redirect chain length and final destination
- [ ] **Result caching**:
  - Cache: `{ urlHash, statusCode, redirectCount, finalUrl, checkedAt }`
  - TTL: 24 hours per URL
  - Store in IndexedDB
- [ ] **Privacy**:
  - Health checks only run when user opts in (off by default)
  - URLs are hashed before any external communication
  - Randomized timing to prevent correlation

---

## Cross-Cutting Tasks

### CT.1 Performance Optimization
- [ ] Use `requestIdleCallback` for all non-critical scans
- [ ] Limit initial scan to viewport only; scan rest on scroll
- [ ] Use IndexedDB instead of `storage.local` for large datasets (>100KB)
- [ ] Debounce MutationObserver to max once per 500ms
- [ ] Disconnect observers on hidden tabs (Page Visibility API)
- [ ] Cap shadow registry to 2000 entries per page
- [ ] Lazy-load content scripts only when needed (manifest `matches` filter)

### CT.2 Accessibility
- [ ] All risk badges have `aria-label` descriptions
- [ ] Custom tooltips are keyboard-navigable (Tab, Enter, Escape)
- [ ] Confirmation dialogs have proper focus trapping
- [ ] Popup and options meet WCAG 2.1 AA contrast ratios
- [ ] All icons have `alt` or `aria-hidden="true"` + `aria-label`
- [ ] Screen reader announcements for blocked redirects

### CT.3 Security
- [ ] All content scripts run in isolated world (manifest `world: "MAIN"` for some, `"ISOLATED"` for others)
- [ ] Messaging validates sender origin before processing
- [ ] Storage data is sanitized before display (prevent XSS in options page)
- [ ] External fetch requests (HEAD checks) have timeout (5s) and size limits
- [ ] No eval() or dynamic code execution
- [ ] CSP headers set for popup and options pages

### CT.4 Localization (i18n)
- [ ] All strings in `_locales/en/messages.json`
- [ ] Placeholder for additional locales (de, fr, es, ja, zh-CN)
- [ ] Risk score reasons use localizable templates
- [ ] Date/number formatting uses `Intl` API

---

## Task Summary by Phase

| Phase | Tasks | Subtasks | Est. Effort |
|-------|-------|----------|-------------|
| P0 — Scaffolding | 4 | 18 | 1-2 days |
| P1a — Core + Event Inspector | 6 | 42 | 7-9 days |
| P1b — Hidden Links & UI | 6 | 45 | 5-7 days |
| P1c — Polish & Test | 4 | 32 | 4-6 days |
| P1.5 — Enhanced Protection | 6 | 38 | 10-14 days |
| P2 — Link Transparency | 4 | 26 | 8-12 days |
| P3 — Advanced Features | 9 | 34 | 12-18 days |
| **TOTAL** | **39** | **235** | **~47-68 days** |
