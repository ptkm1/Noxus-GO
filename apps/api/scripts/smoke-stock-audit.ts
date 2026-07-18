/**
 * Smoke checks estáticos (sem DB) para estoque + roles.
 * Rodar: pnpm exec tsx apps/api/scripts/smoke-stock-audit.ts
 *
 * Com DB: pnpm db:up && pnpm db:migrate:deploy && pnpm db:seed
 */
import assert from "node:assert/strict";
import { assertManagerHasNoStockWrite } from "../src/auth/org-roles.js";
import {
  buildPermissionsMatrix,
  canWrite,
  getPermission,
} from "../src/auth/permissions.js";

assert.equal(assertManagerHasNoStockWrite(), true);
assert.equal(canWrite("MANAGER", "stock"), false);
assert.equal(canWrite("MANAGER", "products"), false);
assert.equal(canWrite("ADMIN", "stock"), true);
assert.equal(getPermission("MANAGER", "stock"), "none");

const matrix = buildPermissionsMatrix();
const manager = matrix.roles.find((r) => r.role === "MANAGER");
assert.ok(manager);
assert.equal(manager.hasSellerProfile, false);

const stock = matrix.resources.find((r) => r.resource === "stock");
assert.ok(stock);
assert.equal(stock.levels.MANAGER, "none");
assert.equal(stock.levels.ADMIN, "write");

console.log("smoke-stock-audit: OK");
console.log("- Gestor sem write em estoque/produtos e sem perfil vendedor");
console.log("- Matriz de permissões consistente");
console.log(
  "Próximo (com Docker): migrate + seed + login admin e POST /admin/stock/entries",
);
