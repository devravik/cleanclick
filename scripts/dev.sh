#!/bin/bash
# CleanClick - Development Helper
# Usage: ./scripts/dev.sh [command]
#
# Commands:
#   build          - Build for Firefox (default)
#   build:chrome   - Build for Chrome/Edge
#   dev            - Build and watch for changes
#   test           - Run unit tests (76/76)
#   package        - Package for Firefox (.zip)
#   package:chrome - Package for Chrome/Edge (.zip)

set -euo pipefail
DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$DIR"

build_firefox() {
    echo "Building for Firefox..."
    npm run build
    echo "Done → dist/"
    echo "Load in: about:debugging → This Firefox → Load Temporary Add-on"
    echo "Select: dist/manifest.json"
}

build_chrome() {
    echo "Building for Chrome/Edge..."
    # Backup Firefox manifest, swap to Chrome manifest
    cp src/manifest.json src/manifest.json.bak
    cp src/manifest.chrome.json src/manifest.json
    npm run build
    # Restore Firefox manifest
    mv src/manifest.json.bak src/manifest.json
    echo "Done → dist/"
    echo "Load in: chrome://extensions → Load unpacked → select dist/"
}

case "${1:-build}" in
    build)
        build_firefox
        ;;
    build:chrome|build:edge)
        build_chrome
        ;;
    dev|watch)
        echo "Watching for changes..."
        npx webpack --mode development --watch
        ;;
    test)
        echo "Running 76 tests..."
        npx jest --no-coverage --verbose
        ;;
    package)
        build_firefox
        cd dist && zip -r ../cleanclick-firefox.zip . && cd ..
        echo "Packaged: cleanclick-firefox.zip"
        ;;
    package:chrome)
        build_chrome
        cd dist && zip -r ../cleanclick-chrome.zip . && cd ..
        echo "Packaged: cleanclick-chrome.zip"
        ;;
    *)
        echo "Usage: $0 {build|build:chrome|dev|test|package|package:chrome}"
        exit 1
        ;;
esac
