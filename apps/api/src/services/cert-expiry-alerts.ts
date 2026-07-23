import { certificateStatus } from "../fiscal/certificate.js";
import { prisma } from "../db.js";
import { notifyUsers } from "./notify.js";

/** Limiares em dias até o vencimento do certificado A1 (0 = vencido). */
export const CERT_EXPIRY_THRESHOLDS = [60, 30, 15, 7, 0] as const;

export type CertExpiryAlertRunResult = {
  organizations: number;
  scanned: number;
  notified: number;
};

/**
 * Notifica ADMIN/MANAGER quando o certificado A1 cruza limiares 60/30/15/7/0.
 * Deduplica via OrganizationFiscalConfig.certificateLastAlertThreshold:
 * só reenvia se o limiar atual for mais crítico (menor) que o já notificado.
 */
export async function runCertificateExpiryAlerts(params?: {
  organizationId?: string;
}): Promise<CertExpiryAlertRunResult> {
  const configs = await prisma.organizationFiscalConfig.findMany({
    where: {
      ...(params?.organizationId
        ? { organizationId: params.organizationId }
        : {}),
      certificatePfxEncrypted: { not: null },
    },
    select: {
      organizationId: true,
      certificateExpiresAt: true,
      certificateLastAlertThreshold: true,
    },
  });

  let notified = 0;

  for (const cfg of configs) {
    const status = certificateStatus(cfg.certificateExpiresAt);
    const threshold = status.alertThreshold;
    if (threshold == null) continue;

    const last = cfg.certificateLastAlertThreshold;
    // Já notificou este limiar ou um mais crítico → skip
    if (last != null && last <= threshold) continue;

    const recipients = await prisma.user.findMany({
      where: {
        organizationId: cfg.organizationId,
        role: { in: ["ADMIN", "MANAGER"] },
      },
      select: { id: true },
    });
    if (!recipients.length) continue;

    const days = status.daysUntilExpiry ?? 0;
    const title =
      threshold === 0
        ? "Certificado digital A1 vencido"
        : `Certificado A1 vence em ${days} dia(s)`;
    const body =
      threshold === 0
        ? "O certificado NF-e está vencido. Emissões e eventos SEFAZ vão falhar até renovar em Faturamento → Configurações."
        : `Faltam ${days} dias para o vencimento do certificado A1 (alerta ${threshold} dias). Renove em Faturamento → Configurações.`;

    await notifyUsers({
      userIds: recipients.map((u) => u.id),
      title,
      body,
      type: "CERT_EXPIRY",
      data: {
        href: "/faturamento",
        alertThreshold: threshold,
        daysUntilExpiry: days,
      },
    });

    await prisma.organizationFiscalConfig.update({
      where: { organizationId: cfg.organizationId },
      data: { certificateLastAlertThreshold: threshold },
    });
    notified += 1;
  }

  return {
    organizations: configs.length,
    scanned: configs.length,
    notified,
  };
}
