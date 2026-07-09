const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');
const HtmlPlugin = require('html-webpack-plugin');

module.exports = {
  entry: {
    // Cross-browser shim must run first in every context
    'content-scripts/browser-shim': './src/shared/browser-shim.js',
    background: './src/background/index.js',
    popup: './src/popup/popup.js',
    options: './src/options/options.js',
    // Content scripts (bundled individually - each has its own scope)
    'content-scripts/event-inspector': './src/content-scripts/event-inspector.js',
    'content-scripts/click-monitor': './src/content-scripts/click-monitor.js',
    'content-scripts/popup-blocker': './src/content-scripts/popup-blocker.js',
    'content-scripts/hidden-link-scanner': './src/content-scripts/hidden-link-scanner.js',
    'content-scripts/link-verifier': './src/content-scripts/link-verifier.js',
    'content-scripts/navigation-guard': './src/content-scripts/navigation-guard.js',
    'content-scripts/dynamic-link-watcher': './src/content-scripts/dynamic-link-watcher.js',
    'content-scripts/scam-overlay-detector': './src/content-scripts/scam-overlay-detector.js',
    'content-scripts/fake-button-detector': './src/content-scripts/fake-button-detector.js',
    'content-scripts/protocol-link-validator': './src/content-scripts/protocol-link-validator.js',
    'content-scripts/link-transparency-ui': './src/content-scripts/link-transparency-ui.js',
    'content-scripts/link-sanitizer': './src/content-scripts/link-sanitizer.js',
    'content-scripts/edge-case-handler': './src/content-scripts/edge-case-handler.js',
    'content-scripts/link-density-analyzer': './src/content-scripts/link-density-analyzer.js',
    'content-scripts/clipboard-guard': './src/content-scripts/clipboard-guard.js',
    'content-scripts/check-injector': './src/content-scripts/check-injector.js',
    'content-scripts/url-shortener-bypass': './src/content-scripts/url-shortener-bypass.js',
  },
  output: {
    globalObject: 'globalThis',
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js',
    clean: true,
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: { presets: [['@babel/preset-env', { targets: { firefox: '109', chrome: '100' } }]] },
        },
      },
    ],
  },
  plugins: [
    new CopyPlugin({
      patterns: [
        { from: 'src/manifest.json', to: 'manifest.json' },
        { from: 'src/assets', to: 'assets' },
        { from: 'src/_locales', to: '_locales' },
        { from: 'src/popup/popup.css', to: 'popup.css' },
        { from: 'src/options/options.css', to: 'options.css' },
      ],
    }),
    new HtmlPlugin({
      template: 'src/popup/index.html',
      filename: 'popup.html',
      chunks: ['popup'],
      inject: 'body',
    }),
    new HtmlPlugin({
      template: 'src/options/index.html',
      filename: 'options.html',
      chunks: ['options'],
      inject: 'body',
    }),
  ],
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, 'src/shared'),
    },
  },
  devtool: 'source-map',
};
