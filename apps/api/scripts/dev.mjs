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

// prisma.config.ts exige DATABASE_URL; carrega .env da API e da raiz antes do generate.
const dotenv = require("dotenv");
dotenv.config({ path: path.join(apiDir, ".env") });
dotenv.config({ path: path.join(apiDir, "..", "..", ".env") });

const env = { ...process.env, NODE_ENV: "development" };

// Garante client Prisma alinhado ao schema (ex.: novos campos como danfeLogoBytes).
const gen = spawnSync("pnpm", ["exec", "prisma", "generate", "--config", "prisma.config.ts"], {
  cwd: apiDir,
  stdio: "inherit",
  shell: process.platform === "win32",
  env,
});
if (gen.status !== 0) {
  console.warn("prisma generate falhou; seguindo com o client atual.");
}

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
