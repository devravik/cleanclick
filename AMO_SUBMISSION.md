# CleanClick — Firefox Add-on Submission

## AMO Listing Details

### Name
**CleanClick**

> Protects you from unwanted redirects, pop-under ads, fake download buttons, and malicious navigation tricks.

### Icon
Icons included in package: `assets/icons/icon-*.png` (16, 32, 48, 96, 128)

---

### Summary (142 chars max)
```
Protects you from unwanted redirects, pop-under ads, fake download buttons, and malicious navigation tricks.
```

### Description (recommended 250+ chars)

CleanClick is a privacy-first browser extension that detects and blocks malicious navigation techniques used by spam sites, ad farms, and phishing pages. It runs entirely in your browser — **zero data collection, zero cloud services, zero telemetry**.

**Features:**

- 🛡️ **Redirect Protection** — Blocks unwanted redirects and pop-under ads triggered by clicks, hover events, or page load
- 🔍 **Hidden Link Scanner** — Detects invisible, off-screen, zero-opacity, and transparent overlay links that trick you into clicking
- ✅ **Link Verification** — Catches hover spoofing, href mutation, homograph domains (lookalike URLs), and Base tag hijacking
- 🚫 **Popup Blocker** — Intercepts `window.open` calls and closes unwanted tabs
- 📋 **Clipboard Guard** — Warns when sites silently modify copied content (e.g., crypto wallet address swapping)
- 🔗 **URL Shortener Bypass** — Previews actual destination of shortened URLs (bit.ly, tinyurl, t.co, etc.)
- 📊 **Link Density Analysis** — Flags pages with excessive outbound links (keyword stuffing / link farms)
- 🩺 **Link Health Checker** — Hover over a link to check if the destination is responsive (HEAD request)
- 🔐 **Navigation Guard** — Monitors form hijacking, meta refresh, Service Worker redirects, History API abuse, and `postMessage` navigation
- 🎭 **Scam Overlay Detector** — Detects fake CAPTCHAs, "Your PC is infected" scareware, and fake close buttons
- 📝 **Fake Download Button Detector** — Scores and flags fake download buttons on freeware/shareware sites
- 🧹 **Link Sanitizer** — Strips tracking parameters (utm_*, fbclid, etc.) automatically
- 🧩 **Custom Rules Engine** — Add your own glob/regex patterns for blocking or flagging
- 📜 **Whitelist** — Per-domain enable/disable with import/export
- 🌐 **16 Languages** — Auto-detects your browser language; switch anytime from popup or options
- 🎨 **Theme Support** — Auto (follows system), Light, or Dark

**Privacy:**
CleanClick does **NOT** collect, store, or transmit any personal data. All processing happens locally in your browser. No accounts. No cloud services. No analytics. No telemetry. Your browsing stays yours.

**Source code:** https://github.com/devravik/cleanclick

---

### Categories
Select up to 3:

- ✅ **Privacy & Security**
- ✅ **Alerts & Updates**
- ✅ **Web Development**

*(or any 1-3 that fit best)*

---

### Support Information

| Field | Value |
|-------|-------|
| **Support email** | *(your preferred email)* |
| **Support website** | `https://github.com/devravik/cleanclick/issues` |
| **License** | **MIT License** |

---

### Privacy Policy

A privacy policy is **not required** because CleanClick collects zero data. However, you may link to:

```
https://github.com/devravik/cleanclick#privacy
```

Or use this text in the add-on's description / About tab:

> **Privacy Policy**
> CleanClick does NOT collect, store, or transmit any personal data. All processing happens locally in your browser. No analytics, no telemetry, no external servers. No accounts or registration required.

---

### Notes to Reviewer

```
Build instructions:
1. Clone: https://github.com/devravik/cleanclick
2. cd cleanclick
3. npm install
4. npm run build
5. Package: cd dist && zip -r ../cleanclick-firefox.zip . -x "*.map"

Source map files (.map) are excluded from the final package.

The extension uses webpack 5 to bundle modules. All source code is in the
src/ directory. The dist/ output maps directly from src/ entries.

No minified/obfuscated third-party code. No eval, no Function constructor,
no remote code execution. All content scripts use setHTML() (DOMParser)
instead of innerHTML assignment for safety.

The extension requires these permissions:
- storage: Save settings, whitelist, statistics locally
- webNavigation: Detect redirects and navigation patterns
- tabs: Query current tab info for popup display
- declarativeNetRequest: Block malicious navigation
- menus / contextMenus: Right-click link inspection
- clipboardRead: Detect clipboard hijacking (no modification)
- contextualIdentities: Optional container isolation (Firefox only)

No data is sent to any external server. All features are fully offline.
```

---

### Tags (optional)

```
cleanclick, security, privacy, redirect-blocker, popup-blocker, anti-phishing,
link-scanner, clipboard-guard, no-tracking, standalone, open-source
```

---

### Version History

| Version | Changes |
|---------|---------|
| **1.0.0** | Initial release |

---

### Preview Assets

Recommended screenshots to include:

1. **Popup UI** — Shows protection status, stats, and scan summary (360px width mockup)
2. **Options Page** — General settings with theme and language selectors
3. **Hidden Link Detection** — Example of invisible link scanning on a test page
4. **Clipboard Warning** — The clipboard guard warning banner in action
5. **Link Transparency** — Risk badges and hover tooltips on links

Screenshots should be 1280×800px or similar, showing the extension UI in context.

---

### Additional Notes

**Minimum Firefox version:** 113.0  
**Add-on ID:** `cleanclick@devravik.github.io`  
**Experimental:** No  
**Requires payment:** No  
**Requires additional hardware:** No  
**Privacy policy URL:** Optional (see above)
