import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../db.js";
import {
  importFiscalCatalogFile,
  resolveFiscalCatalogCode,
  searchFiscalCatalog,
} from "../services/fiscal/fiscal-catalog.js";
import { validateProductFiscalAgainstCatalog } from "./fiscal-catalog-validation.js";

const RUN = Boolean(process.env.DATABASE_URL);

describe.runIf(RUN)("fiscal catalog DB", () => {
  const suffix = randomUUID().slice(0, 8);
  const ncmCode = `99${suffix.slice(0, 6)}`.slice(0, 8).padEnd(8, "0");

  beforeAll(async () => {
    await importFiscalCatalogFile({
      type: "ORIGEM",
      sourceVersion: "test",
      entries: [
        { code: "0", description: "Nacional (teste)" },
        { code: "1", description: "Estrangeira (teste)" },
      ],
    });
    await importFiscalCatalogFile({
      type: "NCM",
      sourceVersion: "test",
      entries: [
        {
          code: ncmCode,
          description: `Bebida fermentada teste ${suffix}`,
        },
        {
          code: "22060090",
          description: "Outras bebidas fermentadas",
        },
      ],
    });
    await importFiscalCatalogFile({
      type: "CFOP",
      sourceVersion: "test",
      entries: [
        {
          code: "5102",
          description: "Venda de mercadoria adquirida ou recebida de terceiros",
        },
        {
          code: "1102",
          description: "Compra para comercialização",
        },
      ],
    });
    await importFiscalCatalogFile({
      type: "CEST",
      sourceVersion: "test",
      entries: [
        {
          code: "1705600",
          description: "Água mineral teste",
          metadata: { relatedNcms: ["22011000"] },
        },
      ],
    });
    await importFiscalCatalogFile({
      type: "CSOSN",
      sourceVersion: "test",
      entries: [
        {
          code: "102",
          description: "Tributada pelo Simples Nacional sem permissão de crédito",
        },
      ],
    });
    await importFiscalCatalogFile({
      type: "CST_ICMS",
      sourceVersion: "test",
      entries: [{ code: "00", description: "Tributada integralmente" }],
    });
    await importFiscalCatalogFile({
      type: "NCM",
      sourceVersion: "test-inactive",
      entries: [
        {
          code: "11111111",
          description: "NCM inativo",
          active: false,
          validTo: "2020-01-01",
        },
      ],
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("pesquisa NCM por código parcial", async () => {
    const res = await searchFiscalCatalog({
      type: "NCM",
      q: "2206",
      limit: 20,
    });
    expect(res.items.some((i) => i.code === "22060090")).toBe(true);
  });

  it("pesquisa NCM por descrição", async () => {
    const res = await searchFiscalCatalog({
      type: "NCM",
      q: "bebida",
      limit: 20,
    });
    expect(res.items.length).toBeGreaterThan(0);
    expect(
      res.items.some((i) => i.description.toLowerCase().includes("bebida")),
    ).toBe(true);
  });

  it("pesquisa CFOP por código e descrição", async () => {
    const byCode = await searchFiscalCatalog({ type: "CFOP", q: "5102" });
    expect(byCode.items[0]?.code).toBe("5102");
    const byDesc = await searchFiscalCatalog({ type: "CFOP", q: "venda" });
    expect(byDesc.items.some((i) => i.code === "5102")).toBe(true);
  });

  it("pesquisa CEST", async () => {
    const res = await searchFiscalCatalog({ type: "CEST", q: "17056" });
    expect(res.items.some((i) => i.code === "1705600")).toBe(true);
  });

  it("resolve origem e CST/CSOSN", async () => {
    expect((await resolveFiscalCatalogCode({ type: "ORIGEM", code: "0" }))?.code).toBe(
      "0",
    );
    expect(
      (await resolveFiscalCatalogCode({ type: "CSOSN", code: "102" }))?.description,
    ).toMatch(/Simples/i);
    expect(
      (await resolveFiscalCatalogCode({ type: "CST_ICMS", code: "00" }))?.description,
    ).toMatch(/Tributada/i);
  });

  it("código inexistente retorna null", async () => {
    expect(
      await resolveFiscalCatalogCode({ type: "NCM", code: "00000000" }),
    ).toBeNull();
  });

  it("código inativo/fora de vigência não aparece na busca padrão", async () => {
    const activeSearch = await searchFiscalCatalog({
      type: "NCM",
      q: "11111111",
    });
    expect(activeSearch.items.some((i) => i.code === "11111111")).toBe(false);

    const resolved = await resolveFiscalCatalogCode({
      type: "NCM",
      code: "11111111",
      includeInactive: true,
    });
    expect(resolved?.outdated).toBe(true);
  });

  it("valida produto antigo com código cadastrado e NCM inexistente", async () => {
    const ok = await validateProductFiscalAgainstCatalog(
      {
        name: "Produto legado OK",
        ncm: "22060090",
        ncmId: null,
        fiscalOrigin: 0,
        nfeOrigin: 0,
        fiscalUnit: "UN",
        purchaseUnit: "UN",
        fiscalCest: null,
        cstPis: null,
        fiscalCstIcms: null,
        fiscalCsosn: "102",
        cbsIbsClassification: null,
        ibsClassification: null,
        outboundOperation: { cfop: "5102", direction: "OUTBOUND", active: true },
      },
      { regime: "SIMPLES_NACIONAL", operationKind: "OUTBOUND" },
    );
    expect(ok.filter((i) => i.code === "NCM_UNKNOWN")).toHaveLength(0);

    const bad = await validateProductFiscalAgainstCatalog(
      {
        name: "Produto legado ruim",
        ncm: "00000000",
        ncmId: null,
        fiscalOrigin: 0,
        nfeOrigin: 0,
        fiscalUnit: "UN",
        purchaseUnit: null,
        fiscalCest: null,
        cstPis: null,
        fiscalCstIcms: null,
        fiscalCsosn: null,
        cbsIbsClassification: null,
        ibsClassification: null,
        outboundOperation: null,
      },
      { regime: "SIMPLES_NACIONAL", operationKind: "OUTBOUND" },
    );
    expect(bad.some((i) => i.code === "NCM_UNKNOWN")).toBe(true);
  });

  it("rejeita CFOP de entrada em operação de saída", async () => {
    const issues = await validateProductFiscalAgainstCatalog(
      {
        name: "CFOP errado",
        ncm: "22060090",
        ncmId: null,
        fiscalOrigin: 0,
        nfeOrigin: 0,
        fiscalUnit: "UN",
        purchaseUnit: null,
        fiscalCest: null,
        cstPis: null,
        fiscalCstIcms: null,
        fiscalCsosn: "102",
        cbsIbsClassification: null,
        ibsClassification: null,
        outboundOperation: {
          cfop: "1102",
          direction: "OUTBOUND",
          active: true,
        },
      },
      { regime: "SIMPLES_NACIONAL", operationKind: "OUTBOUND" },
    );
    expect(issues.some((i) => i.code === "CFOP_CONTEXT")).toBe(true);
  });

  it("performance com milhares de registros (busca paginada)", async () => {
    const entries = Array.from({ length: 2500 }, (_, i) => {
      const code = String(80000000 + i).padStart(8, "0");
      return {
        code,
        description: `Item performance ${i} categoria alfa`,
      };
    });
    const t0 = Date.now();
    await importFiscalCatalogFile({
      type: "NCM",
      sourceVersion: `perf-${suffix}`,
      entries,
    });
    const importMs = Date.now() - t0;
    expect(importMs).toBeLessThan(120_000);

    const t1 = Date.now();
    const page = await searchFiscalCatalog({
      type: "NCM",
      q: "alfa",
      limit: 30,
      offset: 0,
    });
    const searchMs = Date.now() - t1;
    expect(page.items.length).toBeLessThanOrEqual(30);
    expect(page.total).toBeGreaterThan(100);
    expect(searchMs).toBeLessThan(5_000);
  }, 180_000);
});
