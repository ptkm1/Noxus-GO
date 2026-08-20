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

export type ExtractedPfx = {
  privateKeyPem: string;
  certPem: string;
  /** Demais certificados do PFX (cadeia do A1), usados no trust store TLS. */
  caPems: string[];
};

export async function loadOrganizationCertificate(
  organizationId: string,
): Promise<LoadedCertificate | null> {
  const config = await prisma.organizationFiscalConfig.findUnique({
    where: { organizationId },
  });
  if (
    !config?.certificatePfxEncrypted ||
    !config.certificatePasswordEncrypted
  ) {
    return null;
  }
  const pfx = decryptBuffer(Buffer.from(config.certificatePfxEncrypted));
  const password = decryptSecret(config.certificatePasswordEncrypted);
  const { privateKeyPem, certPem } = extractPemFromPfx(pfx, password);
  return { pfx, password, privateKeyPem, certPem };
}

export function extractPemFromPfx(pfx: Buffer, password: string): ExtractedPfx {
  const asn1 = forge.asn1.fromDer(
    forge.util.createBuffer(pfx.toString("binary")),
  );
  const pkcs12 = forge.pkcs12.pkcs12FromAsn1(asn1, password);
  const certBags = pkcs12.getBags({ bagType: forge.pki.oids.certBag });
  const shrouded = pkcs12.getBags({
    bagType: forge.pki.oids.pkcs8ShroudedKeyBag,
  });
  const plain = pkcs12.getBags({ bagType: forge.pki.oids.keyBag });
  const certs = (certBags[forge.pki.oids.certBag] ?? [])
    .map((b) => b.cert)
    .filter((c): c is forge.pki.Certificate => Boolean(c));
  const key =
    shrouded[forge.pki.oids.pkcs8ShroudedKeyBag]?.[0]?.key ??
    plain[forge.pki.oids.keyBag]?.[0]?.key;
  if (!certs[0] || !key) {
    throw new Error("Certificado A1 inválido ou senha incorreta");
  }
  return {
    privateKeyPem: forge.pki.privateKeyToPem(key),
    certPem: forge.pki.certificateToPem(certs[0]),
    caPems: certs.slice(1).map((c) => forge.pki.certificateToPem(c)),
  };
}

export function taxRegimeToCrt(
  regime: OrganizationFiscalConfig["taxRegime"],
): string {
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
