#!/usr/bin/env node
/**
 * Inicia a API em dev escolhendo dev.cmd (Windows) ou dev.sh (macOS/Linux).
 * Uso: node scripts/run-dev-api.mjs
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const apiDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "apps", "api");
const isWin = process.platform === "win32";
const env = { ...process.env, NODE_ENV: "development" };

const result = isWin
  ? spawnSync("cmd.exe", ["/c", "scripts\\dev.cmd"], {
      stdio: "inherit",
      cwd: apiDir,
      env,
    })
  : spawnSync("sh", ["scripts/dev.sh"], {
      stdio: "inherit",
      cwd: apiDir,
      env,
    });

if (result.error) {
  console.error(result.error);
  process.exit(1);
}

process.exit(result.status ?? 1);
