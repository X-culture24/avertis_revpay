const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');
const path = require('path');

/**
 * Metro configuration
 * https://facebook.github.io/metro/docs/configuration
 *
 * @type {import('metro-config').MetroConfig}
 */
const config = {
  resolver: {
    alias: {
      '@': './src',
      '@components': './src/components',
      '@screens': './src/screens',
      '@services': './src/services',
      '@store': './src/store',
      '@types': './src/types',
      '@utils': './src/utils',
      '@theme': './src/theme',
    },
    // Force axios to use browser build
    resolverMainFields: ['react-native', 'browser', 'module', 'main'],
    // Blacklist Node.js specific axios files
    blockList: [
      /node_modules\/axios\/dist\/node\/.*/,
    ],
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
