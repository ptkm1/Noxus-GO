import { Percent, Target, type LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";

const CARDS: Array<{
  to: string;
  title: string;
  description: string;
  icon: LucideIcon;
}> = [
  {
    to: "/comissao/faixas",
    title: "Comissões",
    description:
      "Faixas progressivas por faturamento MTD — globais ou por vendedor.",
    icon: Percent,
  },
  {
    to: "/comissao/metas",
    title: "Metas",
    description:
      "Metas mensais por vendedor, equipe ou todos — exibidas no app do vendedor.",
    icon: Target,
  },
];

export function CommissionHubPage() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <nav className="text-sm text-muted-foreground">
          <Link to="/" className="hover:text-foreground">
            Início
          </Link>
          <span className="mx-1.5">›</span>
          <span className="text-foreground">Comissões e metas</span>
        </nav>
        <h1 className="text-2xl font-semibold text-foreground">
          Comissões e metas
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Escolha o que deseja configurar: faixas de comissão progressiva ou
          metas mensais dos vendedores.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {CARDS.map((c) => {
          const Icon = c.icon;
          return (
            <Link
              key={c.to}
              to={c.to}
              className="group surface-card flex gap-4 p-5 transition hover:border-primary/40 hover:shadow-md"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary transition group-hover:bg-primary group-hover:text-primary-foreground">
                <Icon className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground">
                  {c.title}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {c.description}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
