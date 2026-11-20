// Lets the app import the shared OVD tokens from ../../packages/design-tokens
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);
config.watchFolders = [...(config.watchFolders || []), path.resolve(__dirname, '../../packages')];
module.exports = config;
