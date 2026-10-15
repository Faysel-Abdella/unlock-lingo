// https://docs.expo.dev/guides/customizing-metro/
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Web preview: the database runs on sql.js (see DatabaseProvider.web.tsx). Its
// inline build references Node built-ins only on its Node code path.
const NODE_ONLY = new Set(['node:fs', 'node:crypto', 'fs', 'crypto', 'path']);
const defaultResolve = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web' && NODE_ONLY.has(moduleName)) return { type: 'empty' };
  return defaultResolve ? defaultResolve(context, moduleName, platform) : context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
