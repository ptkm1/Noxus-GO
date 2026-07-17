import { prisma } from "../src/db.js";

const DEMO_CNPJ = "11222333000181";
const DEMO_NCM = "27101932";

/** Garante dados fiscais mínimos para emitir NF-e demo (homologação). */
export async function upsertFiscalDemoData(organizationId: string) {
  await prisma.organizationFiscalConfig.upsert({
    where: { organizationId },
    create: {
      organizationId,
      cnpj: DEMO_CNPJ,
      stateRegistration: "123456789112",
      taxRegime: "SIMPLES_NACIONAL",
      uf: "SP",
      city: "São Paulo",
      street: "Rua Exemplo",
      addressNumber: "100",
      district: "Centro",
      zipCode: "01001000",
      cityIbge: "3550308",
      nfeEnvironment: "HOMOLOGATION",
      nfeSeries: 1,
      nfeLastNumber: 0,
    },
    update: {
      cnpj: DEMO_CNPJ,
      stateRegistration: "123456789112",
      taxRegime: "SIMPLES_NACIONAL",
      uf: "SP",
      city: "São Paulo",
      street: "Rua Exemplo",
      addressNumber: "100",
      district: "Centro",
      zipCode: "01001000",
      cityIbge: "3550308",
      nfeEnvironment: "HOMOLOGATION",
    },
  });

  const ncm = await prisma.fiscalNcm.upsert({
    where: {
      organizationId_code: { organizationId, code: DEMO_NCM },
    },
    create: {
      organizationId,
      code: DEMO_NCM,
      description: "Óleo diesel",
      defaultCsosn: "102",
      icmsRate: 0,
    },
    update: {
      description: "Óleo diesel",
      defaultCsosn: "102",
    },
  });

  const operation = await prisma.fiscalOperation.upsert({
    where: {
      organizationId_direction_cfop: {
        organizationId,
        direction: "OUTBOUND",
        cfop: "5102",
      },
    },
    create: {
      organizationId,
      direction: "OUTBOUND",
      cfop: "5102",
      description: "Venda de mercadoria",
      nature: "Venda",
      defaultCsosn: "102",
      movesStock: true,
    },
    update: {
      description: "Venda de mercadoria",
      nature: "Venda",
    },
  });

  await prisma.product.updateMany({
    where: {
      organizationId,
      OR: [{ ncmId: null }, { fiscalOrigin: null }, { fiscalUnit: null }],
    },
    data: {
      ncmId: ncm.id,
      fiscalOrigin: 0,
      fiscalUnit: "UN",
      outboundOperationId: operation.id,
    },
  });

  await prisma.customer.updateMany({
    where: {
      organizationId,
      OR: [
        { cnpj: null },
        { cnpj: "" },
        { street: null },
        { city: null },
        { state: null },
      ],
    },
    data: {
      documentType: "CNPJ",
      cnpj: "11444777000161",
      legalName: "Cliente Demo NF-e",
      tradeName: "Cliente Demo",
      stateRegistration: "ISENTO",
      street: "Av. Paulista",
      number: "1000",
      neighborhood: "Bela Vista",
      city: "São Paulo",
      state: "SP",
      cep: "01310100",
      cityIbgeCode: "3550308",
    },
  });

  console.log("Dados fiscais demo garantidos (config, NCM, cliente e produtos).");
}
