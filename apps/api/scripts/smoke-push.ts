/**
 * Dispara um push de teste (inbox + Expo + Web Push) para um utilizador.
 *
 * Uso:
 *   pnpm exec dotenv -e apps/api/.env -- tsx apps/api/scripts/smoke-push.ts --email=vendedor@demo.com
 *   pnpm exec dotenv -e apps/api/.env -- tsx apps/api/scripts/smoke-push.ts --list
 *
 * Pré-requisito: o device já registou token (login no app / ativar alertas na web).
 */
import { prisma } from "../src/db.js";
import { notifyUsers } from "../src/services/notify.js";

function argValue(name: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length).trim() : undefined;
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

async function listDevices() {
  const devices = await prisma.pushDevice.findMany({
    orderBy: { updatedAt: "desc" },
    take: 20,
    include: {
      user: { select: { email: true, name: true, role: true } },
    },
  });
  if (!devices.length) {
    console.log(
      "Nenhum PushDevice na base. Faz login no app ou ativa Web Push.",
    );
    return;
  }
  console.log(`PushDevice (últimos ${devices.length}):`);
  for (const d of devices) {
    const token = d.expoPushToken
      ? `${d.expoPushToken.slice(0, 28)}…`
      : d.webPushEndpoint
        ? `${d.webPushEndpoint.slice(0, 48)}…`
        : "(vazio)";
    console.log(
      `- ${d.platform.padEnd(7)} ${d.user.email} (${d.user.role}) · ${token} · ${d.updatedAt.toISOString()}`,
    );
  }
}

async function smokeForEmail(email: string) {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, name: true, role: true },
  });
  if (!user) {
    console.error(`Utilizador não encontrado: ${email}`);
    process.exitCode = 1;
    return;
  }

  const devices = await prisma.pushDevice.findMany({
    where: { userId: user.id },
  });
  const expoCount = devices.filter((d) => d.expoPushToken).length;
  const webCount = devices.filter((d) => d.platform === "WEB").length;

  console.log(`Utilizador: ${user.name} <${user.email}> (${user.role})`);
  console.log(
    `Devices: ${devices.length} total · Expo=${expoCount} · Web=${webCount}`,
  );

  if (!devices.length) {
    console.warn(
      "Sem PushDevice — o smoke cria a notificação na inbox, mas não há canal de push.",
    );
  }

  const stamp = new Date().toLocaleString("pt-BR");
  await notifyUsers({
    userIds: [user.id],
    title: "Smoke push PedixPro",
    body: `Teste de notificação às ${stamp}`,
    type: "GENERIC",
    data: { href: "/(tabs)/notifications", smoke: true },
  });

  const inbox = await prisma.notification.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });

  console.log("notifyUsers: OK");
  if (inbox) {
    console.log(
      `Inbox: "${inbox.title}" · type=${inbox.type} · ${inbox.createdAt.toISOString()}`,
    );
  }
  console.log(
    "Se o device estiver registado e o FCM/EAS corretos, o push deve chegar em segundos.",
  );
}

async function main() {
  if (hasFlag("list")) {
    await listDevices();
    return;
  }

  const email = argValue("email") ?? "vendedor@demo.com";
  await smokeForEmail(email);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
