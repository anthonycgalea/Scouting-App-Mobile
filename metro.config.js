const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// --- Keep your existing wasm settings ---
if (!config.resolver.assetExts.includes('wasm')) {
  config.resolver.assetExts.push('wasm');
}

config.resolver.sourceExts = config.resolver.sourceExts.filter(
  (ext) => ext !== 'wasm'
);

// --- 🔧 Add shims for Node-only modules that break bundling (ws, stream) ---
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  ws: path.resolve(__dirname, 'src/shims/empty.js'),
  stream: path.resolve(__dirname, 'src/shims/empty.js'),
  net: path.resolve(__dirname, 'src/shims/empty.js'),
  tls: path.resolve(__dirname, 'src/shims/empty.js'),
};

// --- 🧱 Optionally block Metro from even trying to bundle them ---
config.resolver.blockList = [
  /node_modules[/\\]ws[/\\]/,
  /node_modules[/\\]stream[/\\]/,
  /node_modules[/\\]net[/\\]/,
  /node_modules[/\\]tls[/\\]/,
];

module.exports = config;
