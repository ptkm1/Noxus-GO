import { FormField, FormGrid, FormSection } from "@/components/forms";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { fieldControlClass } from "@/lib/field-styles";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { apiFetch } from "../lib/api";
import { notifySuccess } from "../lib/app-notifications";

type FiscalNcm = {
  id: string;
  code: string;
  description: string;
  cest: string | null;
  defaultCsosn: string | null;
  icmsRate: unknown;
  active: boolean;
};

type FiscalOperation = {
  id: string;
  direction: "INBOUND" | "OUTBOUND";
  cfop: string;
  description: string;
  nature: string | null;
  defaultCsosn: string | null;
  movesStock: boolean;
  active: boolean;
};

export function FiscalCadastrosPanel() {
  const qc = useQueryClient();

  const [ncmCode, setNcmCode] = useState("");
  const [ncmDesc, setNcmDesc] = useState("");
  const [ncmCsosn, setNcmCsosn] = useState("102");
  const [ncmIcms, setNcmIcms] = useState("");

  const [opDirection, setOpDirection] = useState<"OUTBOUND" | "INBOUND">(
    "OUTBOUND",
  );
  const [opCfop, setOpCfop] = useState("");
  const [opDesc, setOpDesc] = useState("");
  const [opNature, setOpNature] = useState("");
  const [opMovesStock, setOpMovesStock] = useState(false);

  const { data: ncms = [] } = useQuery({
    queryKey: ["admin", "fiscal", "ncm"],
    queryFn: () => apiFetch<FiscalNcm[]>("/admin/fiscal/ncm"),
  });

  const { data: operations = [] } = useQuery({
    queryKey: ["admin", "fiscal", "operations"],
    queryFn: () => apiFetch<FiscalOperation[]>("/admin/fiscal/operations"),
  });

  const createNcm = useMutation({
    mutationFn: () =>
      apiFetch("/admin/fiscal/ncm", {
        method: "POST",
        body: JSON.stringify({
          code: ncmCode.replace(/\D/g, "").padStart(8, "0").slice(0, 8),
          description: ncmDesc,
          defaultCsosn: ncmCsosn || undefined,
          icmsRate: ncmIcms ? Number(ncmIcms) : undefined,
        }),
      }),
    onSuccess: () => {
      setNcmCode("");
      setNcmDesc("");
      notifySuccess("NCM cadastrado.");
      void qc.invalidateQueries({ queryKey: ["admin", "fiscal", "ncm"] });
    },
  });

  const toggleNcm = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      apiFetch(`/admin/fiscal/ncm/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ active }),
      }),
    onSuccess: () =>
      void qc.invalidateQueries({ queryKey: ["admin", "fiscal", "ncm"] }),
  });

  const createOp = useMutation({
    mutationFn: () =>
      apiFetch("/admin/fiscal/operations", {
        method: "POST",
        body: JSON.stringify({
          direction: opDirection,
          cfop: opCfop,
          description: opDesc,
          nature: opNature || undefined,
          defaultCsosn: "102",
          movesStock: opMovesStock,
        }),
      }),
    onSuccess: () => {
      setOpCfop("");
      setOpDesc("");
      setOpNature("");
      setOpMovesStock(false);
      notifySuccess("Operação fiscal cadastrada.");
      void qc.invalidateQueries({
        queryKey: ["admin", "fiscal", "operations"],
      });
    },
  });

  const toggleOp = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      apiFetch(`/admin/fiscal/operations/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ active }),
      }),
    onSuccess: () =>
      void qc.invalidateQueries({
        queryKey: ["admin", "fiscal", "operations"],
      }),
  });

  return (
    <div className="space-y-8">
      <FormSection title="Cadastro NCM">
        <FormGrid cols={3}>
          <FormField label="Código NCM (8 dígitos)">
            <Input
              value={ncmCode}
              onChange={(e) => setNcmCode(e.target.value)}
              placeholder="27101932"
            />
          </FormField>
          <FormField label="Descrição" className="sm:col-span-2">
            <Input
              value={ncmDesc}
              onChange={(e) => setNcmDesc(e.target.value)}
            />
          </FormField>
          <FormField label="CSOSN padrão">
            <Input
              value={ncmCsosn}
              onChange={(e) => setNcmCsosn(e.target.value)}
            />
          </FormField>
          <FormField label="Alíquota ICMS %">
            <Input
              value={ncmIcms}
              onChange={(e) => setNcmIcms(e.target.value)}
            />
          </FormField>
        </FormGrid>
        <Button
          className="mt-3"
          disabled={createNcm.isPending}
          onClick={() => createNcm.mutate()}
        >
          Adicionar NCM
        </Button>
        <div className="mt-4 overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-background text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">Código</th>
                <th className="px-3 py-2 text-left">Descrição</th>
                <th className="px-3 py-2">CSOSN</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {ncms.map((n) => (
                <tr key={n.id} className="border-t border-border">
                  <td className="px-3 py-2 font-mono">{n.code}</td>
                  <td className="px-3 py-2">{n.description}</td>
                  <td className="px-3 py-2 text-center">
                    {n.defaultCsosn ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {n.active ? "Ativo" : "Inativo"}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={toggleNcm.isPending}
                      onClick={() =>
                        toggleNcm.mutate({ id: n.id, active: !n.active })
                      }
                    >
                      {n.active ? "Desativar" : "Ativar"}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </FormSection>

      <FormSection title="Operações fiscais (CFOP)">
        <FormGrid cols={3}>
          <FormField label="Direção">
            <select
              className={fieldControlClass}
              value={opDirection}
              onChange={(e) =>
                setOpDirection(e.target.value as "OUTBOUND" | "INBOUND")
              }
            >
              <option value="OUTBOUND">Saída</option>
              <option value="INBOUND">Entrada</option>
            </select>
          </FormField>
          <FormField label="CFOP">
            <Input
              value={opCfop}
              onChange={(e) => setOpCfop(e.target.value)}
              placeholder="5102"
              maxLength={4}
            />
          </FormField>
          <FormField label="Descrição">
            <Input value={opDesc} onChange={(e) => setOpDesc(e.target.value)} />
          </FormField>
          <FormField label="Natureza" className="sm:col-span-2">
            <Input
              value={opNature}
              onChange={(e) => setOpNature(e.target.value)}
              placeholder="Venda de mercadoria"
            />
          </FormField>
          <FormField label="Movimenta estoque">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={opMovesStock}
                onCheckedChange={(v) => setOpMovesStock(v === true)}
              />
              Sim
            </label>
          </FormField>
        </FormGrid>
        <Button
          className="mt-3"
          disabled={createOp.isPending}
          onClick={() => createOp.mutate()}
        >
          Adicionar operação
        </Button>
        <div className="mt-4 overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-background text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">Direção</th>
                <th className="px-3 py-2">CFOP</th>
                <th className="px-3 py-2 text-left">Descrição</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {operations.map((o) => (
                <tr key={o.id} className="border-t border-border">
                  <td className="px-3 py-2">
                    {o.direction === "OUTBOUND" ? "Saída" : "Entrada"}
                  </td>
                  <td className="px-3 py-2 text-center font-mono">{o.cfop}</td>
                  <td className="px-3 py-2">{o.description}</td>
                  <td className="px-3 py-2 text-center">
                    {o.active ? "Ativo" : "Inativo"}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={toggleOp.isPending}
                      onClick={() =>
                        toggleOp.mutate({ id: o.id, active: !o.active })
                      }
                    >
                      {o.active ? "Desativar" : "Ativar"}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </FormSection>
    </div>
  );
}
