import {
  FileSpreadsheet,
  Landmark,
  Receipt,
  type LucideIcon,
} from "lucide-react";
import { Link } from "react-router-dom";

const CARDS: Array<{
  to: string;
  title: string;
  description: string;
  icon: LucideIcon;
}> = [
  {
    to: "/fiscal/despesas-fixas",
    title: "Despesas fixas",
    description:
      "Templates recorrentes (aluguel, impostos, etc.) com dia do mês e valor.",
    icon: Landmark,
  },
  {
    to: "/fiscal/contas-a-pagar",
    title: "Contas a pagar",
    description:
      "Lançamentos com fornecedor, vencimento, descontos, juros e status.",
    icon: Receipt,
  },
  {
    to: "/fiscal/xml",
    title: "Exportar XML NF-e",
    description:
      "Gera XML provisório a partir de pedidos confirmados (sem emissão SEFAZ).",
    icon: FileSpreadsheet,
  },
];

export function FiscalHubPage() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <nav className="text-sm text-muted-foreground">
          <Link to="/" className="hover:text-foreground">
            Início
          </Link>
          <span className="mx-1.5">›</span>
          <span className="text-foreground">Fiscal</span>
        </nav>
        <h1 className="text-2xl font-semibold text-foreground">Fiscal</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Despesas operacionais e exportação de XML NF-e provisório. A emissão
          real com certificado fica para um ciclo futuro.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
