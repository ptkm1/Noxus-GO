import { useConfirm } from "@/components/confirm";
import { DateTimePicker } from "@/components/ui/date-picker";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { apiFetch } from "../lib/api";

type TitleRow = {
  id: string;
  reference: string | null;
  amount: unknown;
  paidAmount: unknown;
  issueDate: string;
  dueDate: string;
  status: string;
  notes: string | null;
};

function num(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") return Number(v);
  return NaN;
}

export function CustomerTitlesPanel({ customerId }: { customerId: string }) {
  const qc = useQueryClient();
  const { confirm } = useConfirm();
  const { data: titles = [], isLoading } = useQuery({
    queryKey: ["admin", "credit-titles", customerId],
    queryFn: () =>
      apiFetch<TitleRow[]>(`/admin/customers/${customerId}/credit-titles`),
  });

  const [amount, setAmount] = useState("");
  const [due, setDue] = useState("");
  const [ref, setRef] = useState("");

  const create = useMutation({
    mutationFn: () =>
      apiFetch(`/admin/customers/${customerId}/credit-titles`, {
        method: "POST",
        body: JSON.stringify({
          reference: ref.trim() || undefined,
          amount: Number(amount.replace(",", ".")),
          dueDate: new Date(due).toISOString(),
        }),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({
        queryKey: ["admin", "credit-titles", customerId],
      });
      setAmount("");
      setDue("");
      setRef("");
    },
  });

  const markPaid = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/admin/credit-titles/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "PAID" }),
      }),
    onSuccess: () =>
      void qc.invalidateQueries({
        queryKey: ["admin", "credit-titles", customerId],
      }),
  });

  const remove = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/admin/credit-titles/${id}`, { method: "DELETE" }),
    onSuccess: () =>
      void qc.invalidateQueries({
        queryKey: ["admin", "credit-titles", customerId],
      }),
  });

  return (
    <div className="mt-6 rounded-lg border border-border bg-background/80 p-4">
      <h3 className="text-sm font-semibold text-foreground">
        Títulos em aberto / histórico recente
      </h3>
      <p className="mt-1 text-xs text-muted-foreground">
        Cadastre duplicatas ou carnês; vencidos bloqueiam ou pedem aprovação
        conforme a política da empresa.
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        <input
          className="rounded border px-2 py-1 text-xs"
          placeholder="Ref. (opcional)"
          value={ref}
          onChange={(e) => setRef(e.target.value)}
        />
        <input
          className="w-28 rounded border px-2 py-1 text-xs"
          placeholder="Valor R$"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <DateTimePicker
          value={due}
          onChange={setDue}
          placeholder="Vencimento"
          className="min-w-[16rem]"
        />
        <button
          type="button"
          className="rounded bg-primary px-3 py-1 text-xs text-primary-foreground disabled:opacity-50"
          disabled={!amount || !due || create.isPending}
          onClick={() => create.mutate()}
        >
          Lançar título
        </button>
      </div>

      {isLoading ? (
        <p className="mt-3 text-xs text-muted-foreground">
          Carregando títulos…
        </p>
      ) : (
        <div className="mt-3">
          <Table className="min-w-[560px] text-xs">
            <TableHeader>
              <TableRow>
                <TableHead className="py-2 pr-2">Ref.</TableHead>
                <TableHead className="py-2 pr-2">Valor</TableHead>
                <TableHead className="py-2 pr-2">Pago</TableHead>
                <TableHead className="py-2 pr-2">Vencimento</TableHead>
                <TableHead className="py-2 pr-2">Status</TableHead>
                <TableHead className="py-2" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {titles.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="py-2 pr-2">
                    {t.reference ?? "—"}
                  </TableCell>
                  <TableCell className="py-2 pr-2 tabular-nums">
                    R$ {num(t.amount).toFixed(2)}
                  </TableCell>
                  <TableCell className="py-2 pr-2 tabular-nums">
                    R$ {num(t.paidAmount).toFixed(2)}
                  </TableCell>
                  <TableCell className="py-2 pr-2 whitespace-nowrap">
                    {new Date(t.dueDate).toLocaleString("pt-BR")}
                  </TableCell>
                  <TableCell className="py-2 pr-2">{t.status}</TableCell>
                  <TableCell className="py-2 text-right">
                    {t.status === "OPEN" ? (
                      <button
                        type="button"
                        className="text-primary hover:underline"
                        disabled={markPaid.isPending}
                        onClick={() => markPaid.mutate(t.id)}
                      >
                        Quitar
                      </button>
                    ) : null}{" "}
                    <button
                      type="button"
                      className="text-destructive hover:underline"
                      onClick={() => {
                        void confirm({
                          title: "Remover título?",
                          description:
                            "Este título de crédito será removido do sistema.",
                          confirmLabel: "Remover",
                          tone: "destructive",
                        }).then((ok) => {
                          if (ok) remove.mutate(t.id);
                        });
                      }}
                    >
                      Excluir
                    </button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {titles.length === 0 ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Nenhum título cadastrado.
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}
