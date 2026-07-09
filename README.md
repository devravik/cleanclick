# CleanClick

**A standalone browser extension** that protects you from unwanted redirects, pop-under ads, hidden links, fake download buttons, and malicious navigation tricks - with **zero external dependencies, no cloud services, and no data collection.**

Everything runs locally in your browser. Your browsing stays yours.

## Features

### Click Protection
- **Redirect Detector** - Monitors navigation after clicks; blocks unexpected redirects, pop-unders, and interstitial ads
- **Popup Blocker** - Intercepts `window.open()` calls; closes unwanted tabs before they steal focus
- **Event Layer Inspector** - Monkey-patches `addEventListener` to detect navigation hijacking in real time
- **Click Monitor** - Records click context (target, coordinates, modifiers); compares against registered listeners

### Link Transparency
- **Hidden Link Scanner** - Detects invisible links (zero opacity, zero size, off-screen, color-matched, z-index stacked, transparent overlays)
- **Link Verifier** - Checks for hover spoofing, href mutation, homograph domains (Punycode/Unicode), Base tag hijacking, subdomain confusion, protocol abuse
- **Protocol Link Validator** - Validates `tel:`, `sms:`, `mailto:`, and external app launch links; blocks premium-rate numbers; warns before launching external apps
- **Link Sanitizer** - Strips tracking parameters (UTM, fbclid, gclid, etc.); detects affiliate links; pre-expands shortened URLs

### Scam & Malware Protection
- **Scam Overlay Detector** - Detects fake virus warnings, prize scams, fake CAPTCHA overlays, and fake close buttons that redirect
- **Fake Download Button Detection** - Scores download buttons using 10+ heuristics; places Safe/Suspicious badges on each
- **Clipboard Hijacking Protection** - Monitors `clipboard.writeText()` for crypto address tampering; detects silent clipboard modification after copy events
- **Density Analyzer** - Flags link farms and keyword-stuffed pages by analyzing link-to-text ratio, external domain uniqueness, and keyword frequency

### Navigation Guard
- **Form Hijacking Detection** - Checks if form actions point to a different origin; shows warning and blocks submission
- **Meta Refresh Interception** - Catches cross-origin `meta refresh` redirects; asks user before following
- **History API Abuse** - Monitors `pushState`/`replaceState` for cross-origin navigation
- **PostMessage Guard** - Validates `postMessage` origins; detects navigation triggered by incoming messages
- **Service Worker Monitor** - Warns when cross-origin service workers are registered

### Edge Case Coverage
- Frame escape detection, SVG `<a>` links, custom element link detection, unicode bidi overrides, zero-width characters, same-domain UGC paths, iframe `srcdoc` scanning, `<object>`/`<embed>` data URL checks, service worker `clients.openWindow` monitoring

### Customization
- **Website Whitelist** - Per-domain enable/disable with manual add, bulk import/export
- **Custom Blocking Rules** - Glob, regex, or domain patterns; actions: block, warn, allow
- **Per-Site Toggle** - Disable protection on trusted sites from the popup

### User Interface
- **Modern Popup** (340px) - Protection toggle, live stats, link scan summary, settings link
- **Full Options Page** - 5-tab layout: General settings, Whitelist management, Statistics, Custom Rules, About
- **Dark Mode** - Automatic, follows system preference
- **Link Transparency** - Optional risk badge overlays and hover tooltips (disabled by default)

### Privacy & Permissions
- **Zero data collection.** No telemetry, no analytics, no external servers.
- **Minimal permissions.** Uses `webNavigation`, `storage`, `scripting`, `menus`, `notifications` - all standard extension APIs.
- **Link health checks are opt-in.** HEAD requests are sent only to the URLs you interact with; results cached locally for 24 hours.
- **No cloud.** No accounts, no backend, no AI models.

## Installation

### From Source (Firefox)
```bash
git clone https://github.com/devravik/cleanclick.git
cd cleanclick
npm install
npm run build
# Open about:debugging → This Firefox → Load Temporary Add-on
# Select dist/manifest.json
```

## Development
```bash
./scripts/dev.sh build    # Production build
./scripts/dev.sh dev      # Watch mode
./scripts/dev.sh test     # Run 76 unit tests
./scripts/dev.sh package  # Create distributable .zip
```

## Architecture

```
POPUP / OPTIONS    ← user controls, stats display
BACKGROUND SCRIPT  ← redirect-detector, reputation, rules-engine, ...
CONTENT SCRIPTS    ← event-inspector, hidden-link-scanner, navigation-guard, ...
SHARED INFRA       ← constants, utils, link-classifier, event-analyzer, ...
```

See [docs/architecture.md](docs/architecture.md) for the full diagram and data flow.

## Project Status

| Phase | What | Status |
|-------|------|--------|
| P0 | Project scaffolding | ✅ |
| P1a | Core engine + event inspector | ✅ |
| P1b | Hidden links, verification, UI | ✅ |
| P1c | Unit tests (76/76 passing) | ✅ |
| P1.5 | Enhanced protection | ✅ |
| P2 | Link transparency | ✅ |
| P3 | Standalone advanced features | ✅ |

**~8,000+ lines across 40+ source files. Zero external dependencies.**
