import {
  ClipboardList,
  Package,
  ShoppingCart,
  UserCircle,
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
    to: "/relatorios/clientes",
    title: "Clientes",
    description: "Lista de clientes com documento, cidade, vendedor e crédito.",
    icon: UserCircle,
  },
  {
    to: "/relatorios/pedidos",
    title: "Pedidos",
    description:
      "Resumo de pedidos ou romaneio detalhado (um pedido por página).",
    icon: ShoppingCart,
  },
  {
    to: "/romaneio-rota",
    title: "Romaneio de rota",
    description:
      "Selecione pedidos da carga e gere o documento A4 para conferência.",
    icon: ClipboardList,
  },
  {
    to: "/relatorios/itens",
    title: "Itens de pedidos",
    description: "Linhas vendidas com código, quantidade, preços e totais.",
    icon: ClipboardList,
  },
  {
    to: "/relatorios/estoque",
    title: "Estoque",
    description: "Saldos, grupos, fornecedores e validade próxima.",
    icon: Package,
  },
];

export function ReportsHubPage() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <nav className="text-sm text-muted-foreground">
          <Link to="/" className="hover:text-foreground">
            Início
          </Link>
          <span className="mx-1.5">›</span>
          <span className="text-foreground">Relatórios</span>
        </nav>
        <h1 className="text-2xl font-semibold text-foreground">Relatórios</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Escolha um relatório para aplicar filtros e baixar o PDF. Para o
          painel analítico do dia a dia, use{" "}
          <Link
            to="/insights"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Insights
          </Link>
          .
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
