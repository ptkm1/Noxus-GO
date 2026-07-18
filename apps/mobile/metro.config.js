const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// expo-sqlite na web precisa de .wasm + headers COEP/COOP (SharedArrayBuffer)
config.resolver.assetExts.push("wasm");
config.server.enhanceMiddleware = (middleware) => {
  return (req, res, next) => {
    res.setHeader("Cross-Origin-Embedder-Policy", "credentialless");
    res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
    return middleware(req, res, next);
  };
};

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

// Uma única cópia de React (evita "Invalid hook call" com pnpm + Metro)
const reactDir = path.resolve(workspaceRoot, "node_modules/react");
const reactNativeDir = path.resolve(workspaceRoot, "node_modules/react-native");
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  react: reactDir,
  "react-native": reactNativeDir,
};

const origResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === "react" || moduleName.startsWith("react/")) {
    try {
      return {
        type: "sourceFile",
        filePath: require.resolve(moduleName, { paths: [workspaceRoot] }),
      };
    } catch {
      /* Metro resolve abaixo */
    }
  }
  if (origResolveRequest) {
    return origResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
