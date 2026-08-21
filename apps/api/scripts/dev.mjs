/**
 * Dev server da API — funciona em Windows, macOS e Linux.
 * Chamado por dev.cmd (Windows) e dev.sh (macOS/Linux).
 */
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const apiDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const rootDir = path.join(apiDir, "..", "..");
const require = createRequire(path.join(apiDir, "package.json"));
const tsxCli = require.resolve("tsx/cli");

// prisma.config.ts exige DATABASE_URL; carrega .env da API e da raiz antes do generate.
const dotenv = require("dotenv");
dotenv.config({ path: path.join(apiDir, ".env") });
dotenv.config({ path: path.join(rootDir, ".env") });

const env = { ...process.env, NODE_ENV: "development" };

// Node resolve @pedidos/shared via dist/; recompila para pegar exports novos.
const shared = spawnSync(
  process.execPath,
  [path.join(rootDir, "scripts", "build-package.mjs"), "packages/shared"],
  { cwd: rootDir, stdio: "inherit", env },
);
if (shared.status !== 0) {
  console.warn("@pedidos/shared: build falhou; usando dist atual.");
}

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
