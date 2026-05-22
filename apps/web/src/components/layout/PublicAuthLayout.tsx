import type { ReactNode } from "react";
import { PublicSiteHeader } from "./PublicSiteHeader";

type Props = {
  variant: "login" | "register";
  children: ReactNode;
};

export function PublicAuthLayout({ variant, children }: Props) {
  return (
    <div className="relative flex min-h-screen flex-col bg-background">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,oklch(0.72_0.19_160/0.15),transparent_50%)]" />
      <PublicSiteHeader variant={variant} />
      {children}
    </div>
  );
}
