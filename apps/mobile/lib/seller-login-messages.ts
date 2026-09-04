import type { Role } from "@pedidos/shared";

/** Papéis que podem entrar no app mobile. */
export function isMobileAppRole(role: Role): boolean {
  return role === "SELLER" || role === "ADMIN";
}

export function sellerMobileLoginRejectedMessage(_role: Role): string {
  return "Este app é para vendedores e administradores. Supervisor e gerente terão app próprio em breve.";
}

export function sellerMobileBlockedScreenCopy(_role: Role): {
  title: string;
  body: string;
} {
  return {
    title: "Acesso em breve",
    body: "Por enquanto, apenas contas de vendedor e administrador usam este app. Perfis de supervisor e gerente terão aplicativo dedicado numa próxima versão.",
  };
}
