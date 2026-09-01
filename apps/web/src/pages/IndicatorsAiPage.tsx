import { Sparkles } from "lucide-react";
import { Link } from "react-router-dom";

export function IndicatorsAiPage() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <nav className="text-sm text-muted-foreground">
          <Link to="/" className="hover:text-foreground">
            Início
          </Link>
          <span className="mx-1.5">›</span>
          <span className="text-foreground">Indicadores IA</span>
        </nav>
        <h1 className="text-2xl font-semibold text-foreground">
          Indicadores IA
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Análise assistida por IA sobre vendas, estoque e operação.
        </p>
      </div>

      <div className="surface-card flex max-w-xl flex-col items-start gap-4 p-6">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Sparkles className="h-6 w-6" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-foreground">Em breve</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Estamos preparando a análise assistida por IA. Enquanto isso, use
            os indicadores da home e os relatórios da operação.
          </p>
        </div>
        <Link
          to="/relatorios"
          className="text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          Ir para Relatórios
        </Link>
      </div>
    </div>
  );
}
