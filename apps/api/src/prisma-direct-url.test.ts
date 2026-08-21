import { describe, expect, it } from "vitest";
import {
  migrateDatasourceHost,
  resolveMigrateDatabaseUrl,
  toDirectPostgresUrl,
} from "../prisma-direct-url.ts";

const POOLER =
  "postgresql://user:pass@ep-quiet-waterfall-a4wguz76-pooler.us-east-1.aws.neon.tech/noxusgo?sslmode=require&pgbouncer=true";
const DIRECT_HOST = "ep-quiet-waterfall-a4wguz76.us-east-1.aws.neon.tech";

describe("toDirectPostgresUrl", () => {
  it("remove -pooler do host Neon e pgbouncer=true", () => {
    const out = new URL(toDirectPostgresUrl(POOLER));
    expect(out.hostname).toBe(DIRECT_HOST);
    expect(out.searchParams.get("pgbouncer")).toBeNull();
    expect(out.searchParams.get("sslmode")).toBe("require");
    expect(out.searchParams.get("connect_timeout")).toBe("60");
  });

  it("troca porta 6543 (PgBouncer) por 5432", () => {
    const out = new URL(
      toDirectPostgresUrl("postgresql://u:p@db.example.com:6543/app"),
    );
    expect(out.port).toBe("5432");
  });

  it("não altera host local", () => {
    const out = new URL(
      toDirectPostgresUrl("postgresql://pedidos:pedidos@localhost:5432/pedidos"),
    );
    expect(out.hostname).toBe("localhost");
    expect(out.port).toBe("5432");
  });
});

describe("resolveMigrateDatabaseUrl", () => {
  it("prefere DIRECT_URL e ainda desfaz pooler se estiver errado", () => {
    const url = resolveMigrateDatabaseUrl({
      DIRECT_URL: POOLER,
      DATABASE_URL: "postgresql://other@localhost:5432/x",
    });
    expect(migrateDatasourceHost(url)).toContain(DIRECT_HOST);
    expect(migrateDatasourceHost(url)).not.toContain("-pooler");
  });

  it("usa DATABASE_URL_UNPOOLED quando não há DIRECT_URL", () => {
    const url = resolveMigrateDatabaseUrl({
      DATABASE_URL_UNPOOLED: `postgresql://user:pass@${DIRECT_HOST}/noxusgo`,
      DATABASE_URL: POOLER,
    });
    expect(new URL(url).hostname).toBe(DIRECT_HOST);
  });

  it("cai em DATABASE_URL e remove -pooler", () => {
    const url = resolveMigrateDatabaseUrl({ DATABASE_URL: POOLER });
    expect(new URL(url).hostname).toBe(DIRECT_HOST);
  });

  it("falha sem nenhuma URL", () => {
    expect(() => resolveMigrateDatabaseUrl({})).toThrow(/DIRECT_URL/);
  });
});
