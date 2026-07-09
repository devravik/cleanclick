#!/bin/bash
# CleanClick — Development Helper
# Usage: ./scripts/dev.sh [command]
#
# Commands:
#   build    - Build the extension (webpack production)
#   dev      - Build and watch for changes
#   test     - Run unit tests
#   package  - Create distributable .zip
#   icons    - Generate PNG icons from SVG source

set -euo pipefail
DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$DIR"

case "${1:-build}" in
  build)
    echo "🔨 Building CleanClick..."
    npm run build
    echo "✅ Built to dist/"
    echo "   Load in Firefox → about:debugging → This Firefox → Load Temporary Add-on"
    echo "   Select: dist/manifest.json"
    ;;
  dev)
    echo "👀 Watching for changes..."
    npx webpack --mode development --watch
    ;;
  test)
    echo "🧪 Running tests..."
    npm test
    ;;
  package)
    echo "📦 Packaging..."
    npm run build
    cd dist && zip -r ../cleanclick.zip . && cd ..
    echo "✅ Created cleanclick.zip"
    ;;
  icons)
    echo "🖼️  Generating icons..."
    # Generate PNG icons from SVG (requires Inkscape or rsvg-convert)
    for size in 16 32 48 96 128; do
      if command -v rsvg-convert &>/dev/null; then
        rsvg-convert -w "$size" -h "$size" src/assets/icons/icon-${size}.svg \
          > src/assets/icons/icon-${size}.png
      elif command -v inkscape &>/dev/null; then
        inkscape -w "$size" -h "$size" src/assets/icons/icon-${size}.svg \
          --export-filename=src/assets/icons/icon-${size}.png
      else
        echo "⚠️  Need rsvg-convert or inkscape to generate PNG icons"
        exit 1
      fi
    done
    echo "✅ Icons generated"
    ;;
  *)
    echo "Usage: $0 {build|dev|test|package|icons}"
    exit 1
    ;;
esac
