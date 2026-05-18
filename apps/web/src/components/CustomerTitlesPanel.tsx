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
  const { data: titles = [], isLoading } = useQuery({
    queryKey: ["admin", "credit-titles", customerId],
    queryFn: () => apiFetch<TitleRow[]>(`/admin/customers/${customerId}/credit-titles`),
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
      void qc.invalidateQueries({ queryKey: ["admin", "credit-titles", customerId] });
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
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["admin", "credit-titles", customerId] }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => apiFetch(`/admin/credit-titles/${id}`, { method: "DELETE" }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["admin", "credit-titles", customerId] }),
  });

  return (
    <div className="mt-6 rounded-lg border border-slate-100 bg-slate-50/80 p-4">
      <h3 className="text-sm font-semibold text-slate-800">Títulos em aberto / histórico recente</h3>
      <p className="mt-1 text-xs text-slate-500">
        Cadastre duplicatas ou carnês; vencidos bloqueiam ou pedem aprovação conforme a política da empresa.
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
        <input
          type="datetime-local"
          className="rounded border px-2 py-1 text-xs"
          value={due}
          onChange={(e) => setDue(e.target.value)}
        />
        <button
          type="button"
          className="rounded bg-slate-800 px-3 py-1 text-xs text-white disabled:opacity-50"
          disabled={!amount || !due || create.isPending}
          onClick={() => create.mutate()}
        >
          Lançar título
        </button>
      </div>

      {isLoading ? (
        <p className="mt-3 text-xs text-slate-500">Carregando títulos…</p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[560px] text-xs">
            <thead className="text-left text-slate-500">
              <tr>
                <th className="py-2 pr-2">Ref.</th>
                <th className="py-2 pr-2">Valor</th>
                <th className="py-2 pr-2">Pago</th>
                <th className="py-2 pr-2">Vencimento</th>
                <th className="py-2 pr-2">Status</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {titles.map((t) => (
                <tr key={t.id} className="border-t border-slate-200">
                  <td className="py-2 pr-2">{t.reference ?? "—"}</td>
                  <td className="py-2 pr-2 tabular-nums">R$ {num(t.amount).toFixed(2)}</td>
                  <td className="py-2 pr-2 tabular-nums">R$ {num(t.paidAmount).toFixed(2)}</td>
                  <td className="py-2 pr-2 whitespace-nowrap">
                    {new Date(t.dueDate).toLocaleString("pt-BR")}
                  </td>
                  <td className="py-2 pr-2">{t.status}</td>
                  <td className="py-2 text-right">
                    {t.status === "OPEN" ? (
                      <button
                        type="button"
                        className="text-brand-600 hover:underline"
                        disabled={markPaid.isPending}
                        onClick={() => markPaid.mutate(t.id)}
                      >
                        Quitar
                      </button>
                    ) : null}{" "}
                    <button
                      type="button"
                      className="text-red-600 hover:underline"
                      onClick={() => {
                        if (confirm("Remover este título do sistema?")) remove.mutate(t.id);
                      }}
                    >
                      Excluir
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {titles.length === 0 ? (
            <p className="mt-2 text-xs text-slate-400">Nenhum título cadastrado.</p>
          ) : null}
        </div>
      )}
    </div>
  );
}
