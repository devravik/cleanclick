module.exports = {
  testEnvironment: 'jsdom',
  setupFiles: ['./tests/setup.js'],
  transform: {
    '\\.js$': ['babel-jest', { configFile: './babel.config.cjs' }],
  },
  transformIgnorePatterns: [],
  moduleNameMapper: {
    '^webextension-polyfill$': '<rootDir>/tests/__mocks__/browser-mock.js',
  },
};
