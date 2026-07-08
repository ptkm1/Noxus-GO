/**
 * Dev server da API — funciona em Windows, macOS e Linux.
 * Chamado por dev.cmd (Windows) e dev.sh (macOS/Linux).
 */
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const apiDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(path.join(apiDir, "package.json"));
const tsxCli = require.resolve("tsx/cli");

const env = { ...process.env, NODE_ENV: "development" };
const result = spawnSync(process.execPath, [tsxCli, "watch", "src/index.ts"], {
  stdio: "inherit",
  cwd: apiDir,
  env,
});

if (result.error) {
  console.error(result.error);
  process.exit(1);
}

process.exit(result.status ?? 1);
