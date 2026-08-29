import type { ReactNode } from "react";
import { Link } from "react-router-dom";

export function SettingsDetailShell({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <nav className="text-sm text-muted-foreground">
          <Link to="/configuracoes" className="hover:text-foreground">
            Configurações
          </Link>
          <span className="mx-1.5">›</span>
          <span className="text-foreground">{title}</span>
        </nav>
        <h1 className="text-2xl font-semibold text-foreground">{title}</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">{description}</p>
      </div>
      {children}
    </div>
  );
}
