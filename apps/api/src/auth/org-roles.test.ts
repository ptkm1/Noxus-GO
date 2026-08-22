import { describe, expect, it } from "vitest";
import { adminPathToPlanFeature } from "../services/billing/plan-gate.js";
import { adminPathToResource } from "../services/role-permissions.js";
import { adminRelativePath, isManagerGetAllowed } from "./org-roles.js";

describe("adminRelativePath", () => {
  it("remove o prefixo do plugin e a query string", () => {
    expect(adminRelativePath("/api/v1/admin/orders")).toBe("/orders");
    expect(adminRelativePath("/api/v1/admin/reports/orders.pdf?a=1")).toBe(
      "/reports/orders.pdf",
    );
    expect(adminRelativePath("/api/v1/admin")).toBe("/");
    expect(adminRelativePath("/api/v1/admin/")).toBe("/");
  });

  it("mantém caminhos que já são relativos", () => {
    expect(adminRelativePath("/orders")).toBe("/orders");
  });
});

describe("gating do gestor com URL prefixada", () => {
  it("libera os GETs da allow-list", () => {
    for (const url of [
      "/api/v1/admin/orders",
      "/api/v1/admin/sellers",
      "/api/v1/admin/order-situations",
    ]) {
      expect(isManagerGetAllowed(adminRelativePath(url))).toBe(true);
    }
  });

  it("resolve o recurso da matriz de permissões", () => {
    expect(adminRelativePath("/api/v1/admin")).toBe("/");
    expect(adminPathToResource(adminRelativePath("/api/v1/admin"))).toBe(
      "dashboard",
    );
    expect(
      adminPathToResource(adminRelativePath("/api/v1/admin/products")),
    ).not.toBeNull();
  });

  it("mantém o bloqueio por plano ativo", () => {
    expect(
      adminPathToPlanFeature(adminRelativePath("/api/v1/admin/fiscal/settings")),
    ).toBe("fiscal_nfe");
  });
});
