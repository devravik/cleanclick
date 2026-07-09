# Gap Analysis: Spam Link Attack Vectors & Missing Protections

> Companion to DEVELOPMENT_PLAN.md | Generated: 2026-07-09

This document performs an exhaustive analysis of every way spam links appear on web pages, maps them against the current development plan, identifies gaps, and proposes new protection modules to fill them.

---

## Legend

| Icon | Meaning |
|------|---------|
| ✅ | Adequately covered in current plan |
| ⚠️ | Partially covered — needs expansion |
| ❌ | **Not covered** — gap to fill |

---

## CATEGORY 1: Click & Navigation Hijacking

| # | Attack Vector | Description | Status | Gap Analysis |
|---|--------------|-------------|--------|--------------|
| 1 | **Click Event Listener Override** | Page JS attaches `click` listeners to `<a>` tags or their parents that redirect to spam instead of the href | ⚠️ | *Partial*. Click monitor captures clicks but doesn't inspect intercepting event listeners. Need `getEventListeners()` or wrapper detection. |
| 2 | **Mouseup/Mousedown Hijack** | Listeners on `mouseup`/`mousedown` fire before the native click, intercepting navigation | ❌ | Not mentioned. Different event phase than `click`. |
| 3 | **Auxiliary Click Hijack** | Middle-click / wheel-click opens link in new tab but JS intercepts and navigates to spam | ❌ | Not mentioned. `auxclick` events are separate from `click`. |
| 4 | **Context Menu Hijack** | Right-click → "Open in new tab" gets intercepted by contextmenu listener that modifies the link | ❌ | Not mentioned. |
| 5 | **Touch Event Hijack** | `touchstart`/`touchend` on mobile devics intercepts tap before click fires | ❌ | Not mentioned. Mobile-specific. |
| 6 | **Gesture Hijack** | `gesture` events (pinch/zoom/swipe) trigger spam navigation | ❌ | Not mentioned. |
| 7 | **Keyboard Navigation Hijack** | `keydown` (Enter, Space on focused links) intercepted before native navigation | ❌ | Not mentioned. |
| 8 | **Drag-and-Drop Hijack** | `dragstart` on a link replaces the dragged URL with a spam URL | ❌ | Not mentioned. |

### ➤ New Module Needed: Event Layer Inspector (`event-inspector.js`)
Analyzes the event listener stack on links/buttons before the user interacts, flags overriding listeners that redirect to a different domain than the element's href.

---

## CATEGORY 2: Invisible & Hidden Links

| # | Attack Vector | Description | Status | Gap Analysis |
|---|--------------|-------------|--------|--------------|
| 9 | **Zero-Size Links** | `<a>` with `width:0; height:0;` or `1x1px` — clickable but invisible | ❌ | Not mentioned. |
| 10 | **Zero-Opacity Links** | `<a style="opacity:0">` — invisible but clickable | ❌ | Not mentioned. |
| 11 | **Off-Screen Links** | `<a style="position:absolute; left:-9999px">` — off-screen but clickable via tab navigation | ❌ | Not mentioned. |
| 12 | **Font-Size-0 Links** | `<a style="font-size:0">` — invisible text with links | ❌ | Not mentioned. |
| 13 | **Color-Matched Links** | Link color = background color (e.g., `#fff` on `#fff`) | ❌ | Not mentioned. |
| 14 | **Overflow-Hidden Links** | Links hidden inside `overflow:hidden` containers but still in tab order | ❌ | Not mentioned. |
| 15 | **Z-Index Buried Links** | Multiple links stacked at same coordinates; top one is spam | ❌ | Not mentioned. |
| 16 | **Whitespace Area Links** | Links covering large blank areas that redirect to spam | ❌ | Not mentioned. |
| 17 | **Transparent Overlay Links** | `<div style="position:fixed; inset:0; opacity:0">` covering entire page | ❌ | Not mentioned. **Critical gap.** |
| 18 | **Invisible Iframe Clickjacking** | Transparent iframe overlaid on page content | ❌ | Not mentioned. |

### ➤ New Module Needed: Hidden Link Scanner (`hidden-link-scanner.js`)
- Scans DOM for invisible/obscured links with computed styles
- Checks visibility, opacity, dimensions, position, z-index stacking
- Reports all hidden links and highlights them for user inspection
- Detects clickjacking overlays by analyzing full-page transparent elements

---

## CATEGORY 3: Link Spoofing & Deception

| # | Attack Vector | Description | Status | Gap Analysis |
|---|--------------|-------------|--------|--------------|
| 19 | **Hover Spoofing** | CSS `:hover` or JS `mouseenter` changes the URL bar display, but actual href is different | ❌ | Not mentioned. |
| 20 | **Href Mutation on Interaction** | `href` is dynamically changed on `click`/`mousedown` to a spam URL just before navigation | ❌ | Not mentioned. Needs comparing href at hover time vs click time. |
| 21 | **Punycode/IDN Homograph** | Internationalized domain names that visually resemble legitimate domains (e.g., `gοοgle.com` with Greek omicrons) | ❌ | Not mentioned. |
| 22 | **URL Encoding Obfuscation** | Excessively encoded URLs hiding the true destination | ❌ | Not mentioned. |
| 23 | **Subdomain Confusion** | `paypal.security-alert.com.example.com` — legitimate-looking subdomain chains | ❌ | Not mentioned. |
| 24 | **Base Tag Hijacking** | `<base href="https://spam.com">` changes all relative URLs to point to spam | ❌ | Not mentioned. Critical for relative link attacks. |
| 25 | **Link Text vs Href Discrepancy** | Display text says "example.com" but href points to "spam.com" | ❌ | Not mentioned. |
| 26 | **Visual Clone Links** | Fake download/play buttons that visually match real UI but link to ads/malware | ❌ | Partially covered by fake-button-detector (downloads only), not for generic UI clones. |
| 27 | **Title/Aria-Label Spoofing** | Link title tooltip or aria-label shows safe text but href is spam | ❌ | Not mentioned. |
| 28 | **Legitimate Redirect Abuse** | Legitimate services (e.g., `outgoing.proxysite.com?url=spam`) used to mask spam destinations | ⚠️ | Partially covered by URL shortener bypass but not generic redirect services. |
| 29 | **AMP Cache Abuse** | Google AMP cache URLs used to serve spam | ❌ | Not mentioned. |

### ➤ New Module Needed: Link Verifier (`link-verifier.js`)
- Compares displayed text, title, aria-label, and hover URL against actual href
- Detects homograph domains using Unicode normalization
- Normalizes and decodes URLs before comparison
- Monitors `<base>` tag and warns if set to external domain
- Detects href changes between hover and click

---

## CATEGORY 4: Non-Anchor Navigation Hijacking

| # | Attack Vector | Description | Status | Gap Analysis |
|---|--------------|-------------|--------|--------------|
| 30 | **Form Action Hijacking** | `<form action="https://spam.com">` submits credentials/input to spam | ❌ | Not mentioned. |
| 31 | **Form Onsubmit Hijacking** | `onsubmit` handler redirects to spam instead of submitting to action | ❌ | Not mentioned. |
| 32 | **Button Onclick Hijacking** | `<button onclick="window.location='spam'">` disguised as a harmless button | ❌ | Not mentioned. |
| 33 | **Image Map Abuse** | `<map><area>` tags with hidden spam coordinates over legitimate content | ❌ | Not mentioned. |
| 34 | **Meta Refresh Redirect** | `<meta http-equiv="refresh" content="0;url=spam">` — automatic redirect | ❌ | Not mentioned in content-script layer. |
| 35 | **JavaScript Protocol** | `<a href="javascript:window.location='spam'">` — code-execution links | ⚠️ | Partially covered by navigation-guard but not explicitly listed. |
| 36 | **Data URI Links** | `<a href="data:text/html,...">` renders a full spam page | ❌ | Not mentioned. |
| 37 | **Blob URL Links** | Dynamically created blob: URLs containing spam content | ❌ | Not mentioned. |
| 38 | **History API Manipulation** | `history.pushState`/`replaceState` changes URL bar without navigation, used for phishing | ❌ | Not mentioned. |
| 39 | **Service Worker Interception** | Service worker intercepts navigation requests and redirects to spam | ❌ | Not mentioned. Critical gap — SW operates outside extension's content scripts. |
| 40 | **Fetch/JS Redirect** | `fetch()` + `document.write()` or `innerHTML` injection of spam page | ❌ | Not mentioned. |
| 41 | **WebSocket Link Injection** | Live-updating content via WebSocket injects spam links after detection scan | ❌ | Not mentioned. |
| 42 | **PostMessage Navigation** | `window.postMessage` triggers `location.href` change from parent/child frames | ❌ | Not mentioned. |

### ➤ New Module Needed: Multi-Surface Navigation Guard (`navigation-guard.js` — expand)
Expands from simple link monitoring to cover:
- Form submission interception (compare action URL to trusted domains)
- Meta refresh detection and optional blocking
- Service worker registration monitoring
- History API abuse detection
- Data URI/Blob URL link warnings
- PostMessage origin validation

---

## CATEGORY 5: Injected & Third-Party Spam Links

| # | Attack Vector | Description | Status | Gap Analysis |
|---|--------------|-------------|--------|--------------|
| 43 | **Comment/Forum Spam** | Links injected into user-generated content (comments, reviews, forum posts) | ❌ | Not mentioned. |
| 44 | **Signature Spam** | Links in forum/email signatures repurposed on web | ❌ | Not mentioned. |
| 45 | **Dynamic JS Injection** | Scripts that run after page load to inject new spam links into the DOM | ❌ | Not mentioned. |
| 46 | **Ad Network Delivered Spam** | Legitimate ad networks serving ads containing spam links | ❌ | Not mentioned. |
| 47 | **Extension-Injected Links** | Other browser extensions modifying page links | ❌ | Not mentioned. |
| 48 | **WebSocket Real-Time Injection** | Links injected seconds/minutes after page load via WebSocket | ❌ | Not mentioned. |
| 49 | **Server-Sent Events Injection** | Links injected via EventSource/SSE | ❌ | Not mentioned. |
| 50 | **Shadow DOM Links** | Links hidden inside shadow DOM roots, invisible to standard DOM queries | ❌ | Not mentioned. |
| 51 | **Ad Script Link Injection** | Ad scripts that replace legitimate links with affiliate-tagged versions | ❌ | Not mentioned. |

### ➤ New Module Needed: Dynamic Content Monitor (`dynamic-link-watcher.js`)
- MutationObserver watching for new `<a>`, `<form>`, `<area>`, `<button>` elements
- Periodic rescan of all links (configurable interval)
- Shadow DOM traversal
- Comparison of link snapshots over time to detect replacements
- Integration with WebSocket/messaging if possible

---

## CATEGORY 6: Social Engineering Link Attacks

| # | Attack Vector | Description | Status | Gap Analysis |
|---|--------------|-------------|--------|--------------|
| 52 | **Notification Spam** | Push API notification that, when clicked, opens a spam URL | ❌ | Not mentioned. |
| 53 | **Web Share API Abuse** | "Share" dialog triggering navigation to spam | ❌ | Not mentioned. |
| 54 | **Confirm/Prompt Dialog Trap** | Infinite `confirm()`/`alert()` loops that link to "help" pages which are spam | ❌ | Not mentioned. |
| 55 | **Fake CAPTCHA Links** | Fake "I'm not a robot" overlays that link to spam | ❌ | Not mentioned. |
| 56 | **Fake Virus Warning Links** | "Your computer is infected! Click here to clean" overlays | ❌ | Not mentioned. |
| 57 | **Prize/Scam Overlay Links** | "You won! Click to claim" overlays | ❌ | Not mentioned. |
| 58 | **Fake Close Button** | Popup with a fake "X" close button that redirects to spam | ❌ | Not mentioned (related to fake-button-detector). |

### ➤ New Module Needed: Social Engineering Overlay Detector (`scam-overlay-detector.js`)
- Detects full-screen overlays/modals that appeared suddenly
- Analyzes overlay content for scam language patterns
- Detects fake close buttons (click handler redirects instead of closing)
- Wraps `alert/confirm/prompt` to warn about infinite dialog loops
- Monitors Notification API permission and click handlers

---

## CATEGORY 7: Mobile & Telephony Link Abuse

| # | Attack Vector | Description | Status | Gap Analysis |
|---|--------------|-------------|--------|--------------|
| 59 | **tel: Link Spam** | `<a href="tel:+1-900-premium">` leading to premium-rate numbers | ❌ | Not mentioned. |
| 60 | **sms: Link Spam** | `<a href="sms:+1234?body=Subscribe">` signing user up to premium SMS | ❌ | Not mentioned. |
| 61 | **mailto: Harvesting** | `<a href="mailto:spam@trap.com">` with hidden content for email harvesting | ❌ | Not mentioned. |
| 62 | **Intent URL Abuse** | Android `intent://` URLs that launch apps to spam | ❌ | Not mentioned. |
| 63 | **Facetime/Skype Call Spam** | Protocol URLs that initiate calls to premium numbers | ❌ | Not mentioned. |
| 64 | **Marketplace Deep Links** | App store URLs that open install pages without user intent | ❌ | Not mentioned. |

### ➤ New Module Needed: Protocol Link Validator (`protocol-link-validator.js`)
- Categorizes links by protocol (http/https, tel, sms, mailto, intent, etc.)
- Flags premium-rate numbers for tel/sms links
- Warns before launching external applications via deep links
- Maintains allowlist of safe protocol handlers

---

## CATEGORY 8: Tracking & Affiliate Link Abuse

| # | Attack Vector | Description | Status | Gap Analysis |
|---|--------------|-------------|--------|--------------|
| 65 | **Affiliate Link Replacement** | Scripts replacing clean links with affiliate-tagged versions | ❌ | Not mentioned. |
| 66 | **Tracking Parameter Injection** | Adding `?utm_source=...` or fingerprinting params to outgoing links | ❌ | Not mentioned. |
| 67 | **Click Fraud Links** | Hidden links clicked by scripts to generate fake ad revenue | ❌ | Not mentioned. |
| 68 | **Redirect Tracking Chains** | Multiple redirects through tracking domains before destination | ⚠️ | Partially covered by reputation scoring but not by explicit tracking detection. |
| 69 | **Link Fingerprinting** | Unique per-user link parameters that identify the user | ❌ | Not mentioned. |
| 70 | **Pixels and Beacons** | 1x1 images that function as link tracking | ❌ | Not mentioned (out of scope but related). |

### ➤ New Module Needed: Link Sanitizer (`link-sanitizer.js`)
- Strips tracking parameters from links before navigation
- Detects and notifies about affiliate link replacement
- Shows estimated "clean" URL vs "tracked" URL
- Reports redirect chain length before navigation

---

## CATEGORY 9: Content & SEO Spam Links

| # | Attack Vector | Description | Status | Gap Analysis |
|---|--------------|-------------|--------|--------------|
| 71 | **Keyword-Stuffed Links** | Links containing repetitive keywords to manipulate search results | ❌ | Not mentioned. |
| 72 | **Cloaked Links** | Links serving different destinations to users vs crawlers | ❌ | Not mentioned (hard to detect client-side). |
| 73 | **Doorway Page Links** | Links to low-quality pages designed to rank for specific terms | ❌ | Not mentioned. |
| 74 | **Scraped Content Links** | Links in automatically scraped/reposted content | ❌ | Not mentioned. |
| 75 | **Blog Comment Spam** | Automated comment submissions with spam links | ❌ | Not mentioned (out of scope for extension, but detection possible). |
| 76 | **Wiki/Forum Spam** | Spam links in editable wiki pages and forums | ❌ | Not mentioned. |
| 77 | **Link Farms** | Pages with hundreds of outbound links designed to manipulate SEO | ❌ | Not mentioned. |

### ➤ New Module Needed: Link Density Analyzer (`link-density-analyzer.js`)
- Counts links per page area
- Flags pages with abnormally high link density (>50 links in viewport)
- Detects keyword stuffing in link text
- Identifies pages with links to unrelated/non-contextual domains

---

## CATEGORY 10: User Protection & Transparency Features

| # | Protection Feature | Description | Status | Gap Analysis |
|---|-------------------|-------------|--------|--------------|
| 78 | **Link Preview on Hover** | Show real destination URL tooltip (not the browser's status bar) with risk assessment | ❌ | Not mentioned. |
| 79 | **Right-Click Link Inspector** | Enhanced context menu with "Copy clean link," "Check link safety," "Report link" | ❌ | Not mentioned. |
| 80 | **Risk-Based Link Highlighting** | Color-code all links on page by risk level (green/yellow/red badges) | ❌ | Not mentioned. |
| 81 | **Click Confirmation for Risky Links** | Modal dialog "This link looks suspicious. Continue?" before navigating | ❌ | Not mentioned. |
| 82 | **Bulk Link Scan Report** | Toolbar badge showing count of links found / suspicious links on current page | ❌ | Not mentioned. |
| 83 | **Link Destinations Dashboard** | Popup showing all outbound links on the current page grouped by risk level | ❌ | Not mentioned. |
| 84 | **Link Health Ping** | Background check of known links against reputation service | ❌ | Not mentioned. |
| 85 | **Link Relationship Map** | Visual graph showing how links connect to each other (for detective work) | ❌ | Not mentioned. |
| 86 | **One-Click Link Report** | "Report this link as spam" context menu item | ❌ | Not mentioned. |
| 87 | **Safe Share** | Generate clean, track-free versions of links before sharing | ❌ | Not mentioned. |

### ➤ New Module Needed: Link Transparency UI (`link-transparency-ui.js`)
- Overlays risk badges on links (small colored dots/banners)
- Custom tooltip component showing: real URL, redirect chain, risk score
- Enhanced right-click context menu (via `menus` API)
- Page-wide link analysis panel (toggleable sidebar)
- Click interceptor that shows confirmation for medium/high-risk links

---

## CATEGORY 11: Edge Case & Advanced Attack Surfaces

| # | Attack Vector | Description | Status | Gap Analysis |
|---|--------------|-------------|--------|--------------|
| 88 | **Cross-Origin Frame Escaping** | Link within iframe navigating top window to spam via `target="_top"` | ❌ | Not mentioned. |
| 89 | **PDF/Embedded Object Links** | Links inside `<embed>`, `<object>`, `<pdf-viewer>` that open URLs | ❌ | Not mentioned. |
| 90 | **SVG Link Injection** | `<a>` tags inside inline SVGs that inject spam | ❌ | Not mentioned. |
| 91 | **Canvas-Generated Content Links** | Links rendered on `<canvas>` via JS (not real DOM elements) | ❌ | Not mentioned (hard to detect). |
| 92 | **Custom Element Links** | Web component custom elements with link-like behavior | ❌ | Not mentioned. |
| 93 | **Progressive Web App Hijacking** | PWA service workers intercepting navigation | ❌ | Not mentioned. |
| 94 | **Browser Extension DeclarativeNetRequest Bypass** | Attackers using patterns that bypass DNR rules | ⚠️ | DNR mentioned but no strategy for bypass resilience. |
| 95 | **Same-Domain Phishing** | Spam links pointing to the same domain (e.g., user-generated content on trusted sites) | ❌ | Not mentioned. |
| 96 | **Unicode Directional Override** | RTL/LTR override characters that make URLs appear different | ❌ | Not mentioned. |

### ➤ New Module Needed: Edge Case Handler (`edge-case-handler.js`)
- Detects and warns about cross-origin frame navigation (framebuster protection)
- Inspects SVG `<a>` elements
- Monitors custom element definitions that behave like links
- Unicode spoofing detection (bidirectional text, zero-width characters)
- Same-domain but user-generated content link analysis

---

## Summary: Gap Coverage by Category

| Category | Total Vectors | Covered (✅) | Partial (⚠️) | Missing (❌) | Coverage |
|----------|--------------|-------------|--------------|-------------|----------|
| 1. Click & Navigation Hijacking | 8 | 0 | 1 | 7 | **12%** |
| 2. Invisible & Hidden Links | 10 | 0 | 0 | 10 | **0%** |
| 3. Link Spoofing & Deception | 11 | 0 | 1 | 10 | **9%** |
| 4. Non-Anchor Navigation Hijacking | 13 | 0 | 1 | 12 | **8%** |
| 5. Injected & Third-Party Spam | 9 | 0 | 0 | 9 | **0%** |
| 6. Social Engineering Link Attacks | 7 | 0 | 0 | 7 | **0%** |
| 7. Mobile & Telephony Link Abuse | 6 | 0 | 0 | 6 | **0%** |
| 8. Tracking & Affiliate Abuse | 6 | 0 | 1 | 5 | **17%** |
| 9. Content & SEO Spam | 7 | 0 | 0 | 7 | **0%** |
| 10. User Protection & Transparency | 10 | 0 | 0 | 10 | **0%** |
| 11. Edge Cases & Advanced Surfaces | 9 | 0 | 1 | 8 | **11%** |
| **TOTAL** | **96** | **0** | **5** | **91** | **~5%** |

The current plan covers **~5%** of all identified spam link attack vectors. The core redirect detection and popup blocking are solid foundations, but 91 out of 96 vectors are completely unaddressed.

---

## Recommended New Modules (in Priority Order)

These should be integrated into the development plan's phased roadmap:

### Phase 1.5 — Immediate Critical Gaps (do alongside v1.0)

| Module | Priority | Why Now |
|--------|----------|---------|
| **Hidden Link Scanner** | 🔴 Critical | Invisible/transparent links are the #1 spam technique used on file-sharing & streaming sites (the target audience). Zero-opacity overlays are rampant. |
| **Link Verifier** | 🔴 Critical | Hover spoofing and href mutation are trivial to implement for attackers and catch users off-guard daily. |
| **Event Layer Inspector** | 🔴 Critical | Click hijacking is the most common redirect vector; the current plan only records clicks but doesn't prevent hijacking. |
| **Multi-Surface Navigation Guard** | 🟠 High | Forms, meta refresh, service workers, and data URIs are active attack surfaces not covered. |
| **Dynamic Content Monitor** | 🟠 High | Links injected after page load bypass all initial scans. MutationObserver is essential. |

### Phase 2.0 — Enhancements for v1.5

| Module | Priority | Why |
|--------|----------|-----|
| **Scam Overlay Detector** | 🟠 High | Fake virus warnings and CAPTCHA scams are pervasive on the target site categories. |
| **Link Transparency UI** | 🟠 High | Users need visual feedback to trust the extension. Badges, hover previews, and click confirmations build confidence. |
| **Protocol Link Validator** | 🟡 Medium | tel:/sms:/intent: abuse is growing, especially on mobile. |
| **Link Sanitizer** | 🟡 Medium | Tracking param stripping and affiliate link detection add clear user value. |
| **Edge Case Handler** | 🟡 Medium | Cross-origin frames, SVGs, and Unicode spoofing are harder to exploit but worth covering. |

### Phase 3.0 — Future / v2.0

| Module | Priority | Why |
|--------|----------|-----|
| **Link Density Analyzer** | 🟢 Low | Content/SEO spam is a lower risk for the target audience (download/streaming users). |
| **Link Health Check** | 🟢 Low | Server-side pinging of link destinations has privacy implications. |

---

## Proposed New Directory Structure (Additions)

```
src/
├── content-scripts/
│   ├── click-monitor.js              # ✅ Existing
│   ├── event-inspector.js            # 🔴 NEW — Event listener stack analysis
│   ├── hidden-link-scanner.js        # 🔴 NEW — Invisible/obscured link detection
│   ├── link-verifier.js              # 🔴 NEW — Hover vs href comparison, homograph detection
│   ├── dynamic-link-watcher.js       # 🟠 NEW — MutationObserver for injected links
│   ├── scam-overlay-detector.js      # 🟠 NEW — Social engineering overlay detection
│   ├── protocol-link-validator.js    # 🟡 NEW — tel:, sms:, intent: validation
│   ├── link-transparency-ui.js       # 🟠 NEW — Badges, tooltips, confirmation dialogs
│   ├── link-density-analyzer.js      # 🟢 NEW — Page link count & keyword analysis
│   ├── link-sanitizer.js             # 🟡 NEW — Tracking param stripping
│   ├── edge-case-handler.js          # 🟡 NEW — SVG, custom elements, unicode spoofing
│   ├── fake-button-detector.js       # ✅ Existing (v1.5)
│   └── navigation-guard.js           # ⬆️ EXPANDED — Forms, meta refresh, SW, history API
│
├── background/
│   ├── index.js                      # ✅ Existing
│   ├── redirect-detector.js          # ✅ Existing
│   ├── popup-blocker.js              # ✅ Existing
│   ├── whitelist-manager.js          # ✅ Existing
│   ├── statistics.js                 # ✅ Existing
│   ├── reputation.js                 # ✅ Existing
│   ├── event-inspector-background.js # 🔴 NEW — Coordinates event analysis across tabs
│   └── link-health-pinger.js         # 🟢 NEW — Optional reputation pings
│
├── popup/
│   ├── index.html / popup.js / popup.css  # ✅ Existing
│   └── components/
│       ├── stats-panel.js            # ✅ Existing
│       ├── whitelist-panel.js        # ✅ Existing
│       ├── protection-toggle.js      # ✅ Existing
│       ├── link-scanner-report.js    # 🟠 NEW — Scan results for current page
│       └── link-risk-dashboard.js    # 🟡 NEW — All-links risk overview
│
├── options/
│   ├── index.html / options.js / options.css  # ✅ Existing
│   └── components/
│       ├── whitelist-manager.js      # ✅ Existing
│       ├── custom-rules-editor.js    # ✅ Existing (v1.5)
│       └── link-preview-settings.js  # 🟠 NEW — Hover/tooltip preferences
│
└── shared/
    ├── constants.js                  # ✅ Existing — Add link risk thresholds
    ├── messaging.js                  # ✅ Existing — Add new message types
    ├── storage.js                    # ✅ Existing — Add new store sections
    ├── utils.js                      # ✅ Existing — Add URL normalizer, homograph detector
    ├── link-classifier.js            # 🟠 NEW — Link risk scoring engine
    └── event-analyzer.js             # 🟠 NEW — Event listener pattern matcher
```

---

## Revised Roadmap

```
Phase 1.0 ─── Core Protection ──────────────────────────────────────
    ├── Redirect Detector (existing plan)
    ├── Popup Blocker (existing plan)
    ├── Whitelist Manager (existing plan)
    ├── Statistics (existing plan)
    └── Popup/Options UI (existing plan)
    ┌── Hidden Link Scanner          ← NEW — Critical gap
    ├── Link Verifier                ← NEW — Critical gap
    └── Event Layer Inspector        ← NEW — Critical gap

Phase 1.5 ─── Immediate Enhancements ───────────────────────────────
    ├── Multi-Surface Navigation Guard ← EXPANDED
    ├── Dynamic Content Monitor       ← NEW
    ├── Scam Overlay Detector         ← NEW
    └── Fake Button Detector (existing plan)

Phase 2.0 ─── User Transparency & Mobile ───────────────────────────
    ├── Link Transparency UI          ← NEW
    ├── Protocol Link Validator       ← NEW
    ├── Link Sanitizer                ← NEW
    ├── Edge Case Handler             ← NEW
    ├── Reputation Scoring (existing plan)
    └── Custom Blocking Rules (existing plan)

Phase 3.0 ─── Advanced & Future ────────────────────────────────────
    ├── Link Density Analyzer         ← NEW
    ├── Link Health Check             ← NEW
    ├── Cloud Reputation Service (existing plan)
    ├── Community Reporting (existing plan)
    ├── AI Fake Button Detection (existing plan)
    ├── Scam Website Detection (existing plan)
    ├── Clipboard Hijacking Protection (existing plan)
    ├── URL Shortener Bypass (existing plan)
    └── Cross-Device Sync (existing plan)
```

---

## Revised Permissions (Expanded)

```
manifest.json permissions (new additions in bold):

Required:
├── "tabs"                          # ✅ Existing
├── "webNavigation"                  # ✅ Existing
├── "storage"                        # ✅ Existing
├── "scripting"                      # ✅ Existing
├── "declarativeNetRequest"          # ✅ Existing
├── "menus"                          # 🔴 NEW — Right-click link inspector
├── "notifications"                  # 🟠 NEW — Scam overlay warnings
└── "contextualIdentities"          # 🟡 NEW — Container-based isolation (v2.0)

Host permissions:
├── "<all_urls>"                     # ✅ Existing
│                                    # Refine per-site as whitelist grows
```

---

## Conclusion

The current development plan covers only **~5% of spam link attack vectors**. The three most critical additions are:

1. **Hidden Link Scanner** — Transparent overlays, zero-opacity, off-screen, and size-0 links are the #1 unaddressed vector for download/streaming sites.
2. **Link Verifier** — Hover spoofing, homograph domains, and href mutation are trivial attacks that the current plan doesn't prevent.
3. **Event Layer Inspector** — Click hijacking via event listeners is the #1 redirect mechanism; the current click-monitor only records but doesn't prevent.

Adding these modules would raise coverage from **5% to ~40%** in Phase 1, with the remaining vectors addressed in subsequent phases.
