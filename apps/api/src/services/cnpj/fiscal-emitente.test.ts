import { describe, expect, it } from "vitest";
import {
  emptyFiscalEmitente,
  fiscalConfigCreateData,
  fiscalEmitenteFromCnpj,
} from "./fiscal-emitente.js";
import { lookupFiscalEmitente } from "./lookup-fiscal-emitente.js";

describe("fiscalEmitenteFromCnpj", () => {
  it("mapeia CNPJ e endereço para o emitente da NF-e", () => {
    const seed = fiscalEmitenteFromCnpj({
      cnpj: "12.345.678/0001-95",
      razaoSocial: "Empresa Teste LTDA",
      nomeFantasia: "Teste",
      situacaoCadastral: "ATIVA",
      cep: "01310-100",
      uf: "sp",
      municipio: "São Paulo",
      cityIbgeCode: "3550308",
      logradouro: "Avenida Paulista",
      numero: "1000",
      complemento: "Cj 10",
      bairro: "Bela Vista",
      email: null,
      telefone: null,
      naturezaJuridica: null,
    });
    expect(seed.cnpj).toBe("12345678000195");
    expect(seed.uf).toBe("SP");
    expect(seed.zipCode).toBe("01310100");
    expect(seed.street).toBe("Avenida Paulista");
    expect(seed.cityIbge).toBe("3550308");
  });

  it("grava config de faturamento em homologação com série 1", () => {
    const data = fiscalConfigCreateData(
      "org-1",
      emptyFiscalEmitente("12345678000195"),
    );
    expect(data.organizationId).toBe("org-1");
    expect(data.cnpj).toBe("12345678000195");
    expect(data.nfeEnvironment).toBe("HOMOLOGATION");
    expect(data.nfeSeries).toBe(1);
    expect(data.taxRegime).toBe("SIMPLES_NACIONAL");
  });
});

describe("lookupFiscalEmitente", () => {
  it("sem CNPJ válido não consulta a Receita e devolve só o número", async () => {
    const seed = await lookupFiscalEmitente("123");
    expect(seed.cnpj).toBe("123");
    expect(seed.uf).toBeNull();
    expect(seed.street).toBeNull();
  });
});
