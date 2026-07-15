import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { apiFetch } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

type Movement = {
  id: string;
  type: string;
  qtyDelta: number;
  balanceAfter: number;
  lotCode: string | null;
  expiresAt: string | null;
  reason: string | null;
  createdAt: string;
  product: { id: string; name: string; sku: string | null };
  user: {
    id: string;
    name: string;
    email: string;
    matricula: string | null;
  } | null;
};

type MovementsResponse = {
  items: Movement[];
  total: number;
};

const TYPE_LABELS: Record<string, string> = {
  MANUAL_IN: "Entrada",
  MANUAL_OUT: "Saída",
  ADJUST: "Ajuste",
  SALE: "Venda",
  SALE_REVERSAL: "Estorno venda",
};

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("pt-BR");
}

export function StockMovementsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "stock-movements"],
    queryFn: () =>
      apiFetch<MovementsResponse>("/admin/stock/movements?take=100"),
  });

  const items = data?.items ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Histórico de estoque</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Movimentações rastreáveis com usuário e matrícula.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link to="/estoque">Voltar ao estoque</Link>
        </Button>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Carregando…</p>
      ) : items.length === 0 ? (
        <p className="text-muted-foreground">
          Nenhuma movimentação registrada.
        </p>
      ) : (
        <div className="surface-card overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data/hora</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Produto</TableHead>
                <TableHead className="text-right">Δ</TableHead>
                <TableHead className="text-right">Saldo</TableHead>
                <TableHead>Lote</TableHead>
                <TableHead>Usuário</TableHead>
                <TableHead>Motivo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="whitespace-nowrap text-sm">
                    {formatDateTime(m.createdAt)}
                  </TableCell>
                  <TableCell>{TYPE_LABELS[m.type] ?? m.type}</TableCell>
                  <TableCell>
                    <div className="font-medium">{m.product.name}</div>
                    {m.product.sku ? (
                      <div className="text-xs text-muted-foreground">
                        {m.product.sku}
                      </div>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {m.qtyDelta > 0 ? `+${m.qtyDelta}` : m.qtyDelta}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {m.balanceAfter}
                  </TableCell>
                  <TableCell>{m.lotCode ?? "—"}</TableCell>
                  <TableCell>
                    {m.user ? (
                      <div>
                        <div className="text-sm">{m.user.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {m.user.matricula
                            ? `Matrícula ${m.user.matricula}`
                            : m.user.email}
                        </div>
                      </div>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="max-w-[12rem] truncate text-sm text-muted-foreground">
                    {m.reason ?? "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <p className="border-t border-border px-4 py-2 text-xs text-muted-foreground">
            Exibindo {items.length} de {data?.total ?? 0}
          </p>
        </div>
      )}
    </div>
  );
}
