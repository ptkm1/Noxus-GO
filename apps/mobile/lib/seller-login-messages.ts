import type { Role } from "@pedidos/shared";

export function sellerMobileLoginRejectedMessage(role: Role): string {
  if (role === "ADMIN") {
    return "Este app é apenas para vendedores. Administradores usam o painel web.";
  }
  return "Este app é apenas para vendedores. Supervisor e gerente terão app próprio em breve.";
}

export function sellerMobileBlockedScreenCopy(role: Role): { title: string; body: string } {
  if (role === "ADMIN") {
    return {
      title: "Painel web",
      body: "Este aplicativo é exclusivo para vendedores. Para administradores, utilize o painel web no escritório.",
    };
  }
  return {
    title: "Acesso em breve",
    body: "Por enquanto, apenas contas de vendedor usam este app. Perfis de supervisor e gerente terão aplicativo dedicado numa próxima versão.",
  };
}
