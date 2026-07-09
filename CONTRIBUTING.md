# Contributing to CleanClick

Issues, feature requests, and pull requests are welcome. Please open an issue before submitting large feature changes to discuss the proposed implementation.

## Development Setup

1. Clone the repo
2. Run `npm install`
3. Run `npm run build`
4. Load in Firefox via `about:debugging` → This Firefox → Load Temporary Add-on → select `dist/manifest.json`

## Code Style

- ESLint config is provided — run `npm run lint`
- ES modules throughout
- Use `browser.*` API (not `chrome.*`)
- Pure functions for testable logic
- Document all modules in JSDoc where the public API is used across files

## Pull Request Process

1. Update tests for any changed logic
2. Run `npm test` and `npm run lint`
3. Update `DEVELOPMENT_PLAN.md` if adding new features
4. Create a PR with a clear description of the change
