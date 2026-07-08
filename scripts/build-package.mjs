#!/usr/bin/env node
/**
 * Compila um pacote TypeScript (shared, design-tokens, etc.).
 * Uso: node scripts/build-package.mjs [caminho-do-pacote]
 * Default: packages/shared
 */
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const packageDir = path.resolve(rootDir, process.argv[2] ?? "packages/shared");
const require = createRequire(path.join(packageDir, "package.json"));
const tscCli = require.resolve("typescript/bin/tsc");

const result = spawnSync(process.execPath, [tscCli, "-p", "tsconfig.json"], {
  stdio: "inherit",
  cwd: packageDir,
  env: process.env,
});

if (result.error) {
  console.error(result.error);
  process.exit(1);
}

process.exit(result.status ?? 1);
