import type { ReactNode } from "react";
import { PublicSiteHeader } from "./PublicSiteHeader";

type Props = {
  variant: "login" | "register";
  children: ReactNode;
};

/** Shell para telas públicas de autenticação (gradiente + header com logo e link auxiliar). */
export function PublicAuthLayout({ variant, children }: Props) {
  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-brand-900 to-slate-900">
      <PublicSiteHeader variant={variant} />
      {children}
    </div>
  );
}
