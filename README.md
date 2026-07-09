# CleanClick

CleanClick is a browser extension that protects users from unwanted redirects, pop-under advertisements, fake download buttons, and malicious navigation tricks commonly found on download, streaming, and file-sharing websites.

Instead of simply blocking advertisements, CleanClick ensures that every click takes you where you intended to go.

## Features

### Smart Redirect Protection

* Detects unexpected redirects after user clicks.
* Blocks known pop-under and interstitial advertising pages.
* Prevents unwanted tabs from stealing focus.

### Popup Prevention

* Stops suspicious `window.open()` calls.
* Automatically closes unwanted popup tabs.
* Keeps browsing uninterrupted.

### Fake Download Button Detection

* Highlights the most likely legitimate download button.
* Reduces accidental clicks on advertisements.

### Safe Navigation

* Detects suspicious destination domains.
* Warns users before visiting potentially malicious websites.
* Displays the actual destination whenever possible.

### Website Whitelist

* Disable protection on trusted websites.
* Create custom allowlists for sites that legitimately use redirects.

### Statistics

* Redirects blocked
* Popups prevented
* Suspicious domains detected
* Protected browsing sessions

## Planned Features

* Cloud-powered redirect reputation database
* Community reported malicious redirects
* AI-powered fake button detection
* Scam website detection
* Clipboard hijacking protection
* URL shortener bypass (where technically possible)
* Cookie banner cleanup
* Tracker detection
* Phishing protection
* Custom redirect rules
* Import/Export settings
* Browser synchronization

## How It Works

When you click a link, CleanClick records the browsing context and monitors the resulting navigation.

If a newly opened tab or redirect appears unrelated to your intended destination and matches suspicious behavior patterns, the extension can:

* Block the redirect
* Close the unwanted tab
* Return focus to your original page
* Allow legitimate navigation to continue

The goal is to make unwanted redirects effectively invisible to the user.

## Privacy

CleanClick is designed with privacy as a priority.

The extension:

* Does not collect browsing history.
* Does not collect personal information.
* Does not track users.
* Does not sell data.
* Processes navigation locally whenever possible.

Future optional cloud reputation features will only transmit anonymous redirect fingerprints and never personal browsing history.

## Permissions

The extension requires only the permissions necessary to detect and prevent unwanted navigation, such as:

* `tabs`
* `webNavigation`
* `storage`
* `scripting`
* `declarativeNetRequest`
* Host permissions for websites where protection is enabled

## Supported Browsers

* Mozilla Firefox (primary target)
* Firefox Developer Edition
* Firefox ESR (where compatible)

Chromium-based browser support is planned for a future release.

## Development

Clone the repository:

```bash
git clone https://github.com/yourusername/cleanclick.git
```

Install dependencies:

```bash
npm install
```

Build:

```bash
npm run build
```

Run in Firefox:

1. Open `about:debugging`
2. Select **This Firefox**
3. Click **Load Temporary Add-on**
4. Choose the generated `manifest.json`

## Roadmap

### Version 1.0

* Smart redirect blocking
* Popup prevention
* Website whitelist
* Statistics dashboard

### Version 1.5

* Fake download button detection
* Redirect reputation scoring
* Custom blocking rules

### Version 2.0

* Cloud reputation service
* Community reporting
* AI-based scam detection
* Cross-device synchronization

## Contributing

Issues, feature requests, and pull requests are welcome. Please open an issue before submitting large feature changes to discuss the proposed implementation.

## License

MIT License
