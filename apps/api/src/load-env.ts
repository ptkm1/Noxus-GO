/**
 * Tem de ser o primeiro import de `index.ts`.
 * Em ESM os imports são resolvidos em ordem; este ficheiro só carrega env antes de `app`/`jwt`/Prisma.
 */
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.join(dir, "..");
const apiEnv = path.join(apiRoot, ".env");
const monorepoRoot = path.join(apiRoot, "..", "..");
const rootEnv = path.join(monorepoRoot, ".env");

dotenv.config({ path: apiEnv });
dotenv.config({ path: rootEnv });
