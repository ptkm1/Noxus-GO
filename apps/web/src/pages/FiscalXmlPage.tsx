import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";

/**
 * Página provisória de XML a partir do pedido — deprecada.
 * O download do XML autorizado/cancelado fica em Faturamento → NF-e emitidas.
 */
export function FiscalXmlPage() {
  const navigate = useNavigate();

  useEffect(() => {
    const t = window.setTimeout(
      () => navigate("/faturamento", { replace: true }),
      2500,
    );
    return () => window.clearTimeout(t);
  }, [navigate]);

  return (
    <div className="mx-auto max-w-lg space-y-4 py-12 text-center">
      <h1 className="text-xl font-semibold text-foreground">
        Exportação provisória descontinuada
      </h1>
      <p className="text-sm text-muted-foreground">
        O XML gerado só a partir do pedido não substitui a NF-e autorizada na
        SEFAZ. Use <strong>Faturamento</strong> para emitir, consultar e baixar
        o XML autorizado ou de cancelamento.
      </p>
      <Link
        to="/faturamento"
        className="inline-block rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium hover:bg-muted/40"
      >
        Ir para Faturamento
      </Link>
    </div>
  );
}
