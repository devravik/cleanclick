# CleanClick Architecture

## Three-Layer Design

```
┌────────────────────────────────────────────────────┐
│                   POPUP / OPTIONS                   │
│          (user controls, stats display)             │
├────────────────────────────────────────────────────┤
│                  BACKGROUND SCRIPT                  │
│   redirect-detector   popup-blocker   reputation    │
│   whitelist-manager   statistics      rules-engine   │
│   event-coordinator   link-health-pinger            │
├────────────────────────────────────────────────────┤
│                 CONTENT SCRIPTS                     │
│   click-monitor     event-inspector                │
│   hidden-link-scanner  link-verifier               │
│   navigation-guard  popup-blocker                  │
│   dynamic-link-watcher  scam-overlay-detector      │
│   fake-button-detector  protocol-link-validator    │
│   link-transparency-ui  link-sanitizer             │
│   edge-case-handler  link-density-analyzer          │
├────────────────────────────────────────────────────┤
│                 SHARED INFRASTRUCTURE                │
│   constants  messaging  storage  utils              │
│   link-classifier  event-analyzer                   │
└────────────────────────────────────────────────────┘
```

## Data Flow

```
User Click → Content Script (event-inspector + click-monitor)
  → Background (redirect-detector + event-coordinator)
    → Block/Allow decision
      → UI update (popup badge, notification)
```

## Key Principles

- **Content scripts** inspect DOM, monitor events, and overlay UI directly in the page
- **Background script** coordinates between tabs, stores data, makes blocking decisions
- **Shared modules** are pure utility libraries with no browser API dependencies
- **Link classifier** is used by hidden-link-scanner, link-verifier, and link-transparency-ui
- **Event analyzer** is used by event-inspector only
- **Storage.js** and **messaging.js** are used across all layers
