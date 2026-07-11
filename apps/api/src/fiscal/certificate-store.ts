import type { OrganizationFiscalConfig } from "@prisma/client";
import forge from "node-forge";
import { prisma } from "../db.js";
import { decryptBuffer, decryptSecret } from "./encryption.js";

export type LoadedCertificate = {
  pfx: Buffer;
  password: string;
  privateKeyPem: string;
  certPem: string;
};

export async function loadOrganizationCertificate(
  organizationId: string,
): Promise<LoadedCertificate | null> {
  const config = await prisma.organizationFiscalConfig.findUnique({
    where: { organizationId },
  });
  if (!config?.certificatePfxEncrypted || !config.certificatePasswordEncrypted) {
    return null;
  }
  const pfx = decryptBuffer(Buffer.from(config.certificatePfxEncrypted));
  const password = decryptSecret(config.certificatePasswordEncrypted);
  const { privateKeyPem, certPem } = extractPemFromPfx(pfx, password);
  return { pfx, password, privateKeyPem, certPem };
}

export function extractPemFromPfx(pfx: Buffer, password: string) {
  const asn1 = forge.asn1.fromDer(forge.util.createBuffer(pfx.toString("binary")));
  const pkcs12 = forge.pkcs12.pkcs12FromAsn1(asn1, password);
  const certBags = pkcs12.getBags({ bagType: forge.pki.oids.certBag });
  const keyBags = pkcs12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
  const cert = certBags[forge.pki.oids.certBag]?.[0]?.cert;
  const key = keyBags[forge.pki.oids.pkcs8ShroudedKeyBag]?.[0]?.key;
  if (!cert || !key) throw new Error("Certificado A1 inválido ou senha incorreta");
  return {
    privateKeyPem: forge.pki.privateKeyToPem(key),
    certPem: forge.pki.certificateToPem(cert),
  };
}

export function taxRegimeToCrt(regime: OrganizationFiscalConfig["taxRegime"]): string {
  switch (regime) {
    case "SIMPLES_NACIONAL":
      return "1";
    case "LUCRO_PRESUMIDO":
      return "2";
    case "LUCRO_REAL":
      return "3";
    default:
      return "1";
  }
}
