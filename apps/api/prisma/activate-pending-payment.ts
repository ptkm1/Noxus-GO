import { prisma } from "../src/db.js";

/**
 * Libera orgs locais travadas em PENDING_PAYMENT (sem Asaas).
 *
 *   pnpm db:activate-pending
 *   pnpm db:activate-pending mansao@email.com
 */
export async function activatePendingPayment(email?: string) {
  const where = email
    ? {
        users: {
          some: { email: { equals: email, mode: "insensitive" as const } },
        },
      }
    : { accessStatus: "PENDING_PAYMENT" as const };

  const orgs = await prisma.organization.findMany({
    where,
    select: {
      id: true,
      name: true,
      accessStatus: true,
      users: { select: { email: true, role: true } },
      subscription: { select: { planId: true } },
    },
  });

  if (orgs.length === 0) {
    throw new Error(
      email
        ? `Nenhuma organização encontrada para ${email}`
        : "Nenhuma organização com PENDING_PAYMENT",
    );
  }

  const periodEnd = new Date();
  periodEnd.setFullYear(periodEnd.getFullYear() + 1);

  for (const org of orgs) {
    await prisma.organization.update({
      where: { id: org.id },
      data: { accessStatus: "ACTIVE" },
    });
    await prisma.organizationSubscription.updateMany({
      where: { organizationId: org.id },
      data: {
        status: "ACTIVE",
        provider: "none",
        cancelAtPeriodEnd: false,
        gracePeriodEndsAt: null,
        currentPeriodStart: new Date(),
        currentPeriodEnd: periodEnd,
      },
    });
    const emails = org.users.map((u) => u.email).join(", ");
    console.log(
      `  ${org.name} (${org.accessStatus} → ACTIVE) · ${emails} · plano ${org.subscription?.planId ?? "?"}`,
    );
  }

  return orgs.length;
}

async function main() {
  const email = process.argv.slice(2).find((a) => a.includes("@"));
  console.log(
    email
      ? `Liberando acesso da org de ${email}…`
      : "Liberando todas as orgs PENDING_PAYMENT…",
  );
  const n = await activatePendingPayment(email);
  console.log(`${n} organização(ões) ativa(s). Entre de novo no painel.`);
}

const isDirectRun = process.argv[1]?.includes("activate-pending-payment");
if (isDirectRun) {
  main()
    .then(() => prisma.$disconnect())
    .catch((e) => {
      console.error(e);
      void prisma.$disconnect();
      process.exit(1);
    });
}
