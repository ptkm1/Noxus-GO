/**
 * Smoke estático dos helpers de relatórios PDF.
 * Rodar: pnpm exec tsx apps/api/scripts/smoke-reports-pdf.ts
 */
import assert from "node:assert/strict";
import { lineDiscount, orderCode } from "../src/services/reports/pdf-common.js";

assert.equal(orderCode({ id: "abcdefghijklmnop" }), "#abcdefgh");
assert.equal(orderCode({ id: "abcdefghijklmnop", orderNumber: 42 }), "42");
assert.equal(lineDiscount({ unitPrice: 8, basePrice: 10 }), 2);
assert.equal(lineDiscount({ unitPrice: 10, basePrice: 8 }), 0);
assert.equal(lineDiscount({ unitPrice: 10 }), 0);

console.log("smoke-reports-pdf: OK");
console.log("- orderCode / lineDiscount");
console.log(
  "Com DB: GET /admin/reports/{customers,orders,order-items,stock}.pdf com token ADMIN",
);
