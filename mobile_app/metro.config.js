const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Add support for additional file extensions
config.resolver.assetExts.push('db', 'mp3', 'ttf', 'obj', 'png', 'jpg');

// Add support for TypeScript path mapping
config.resolver.alias = {
  '@': './src',
  '@components': './src/components',
  '@screens': './src/screens',
  '@services': './src/services',
  '@store': './src/store',
  '@types': './src/types',
  '@utils': './src/utils',
  '@theme': './src/theme',
};

module.exports = config;
