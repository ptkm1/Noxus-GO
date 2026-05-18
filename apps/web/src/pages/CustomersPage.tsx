import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { CnpjCompanyData } from "@pedidos/shared";
import { suggestedTradeName } from "@pedidos/shared";
import { apiFetch } from "../lib/api";
import { CnpjLookupField } from "../components/CnpjLookupField";
import { CustomerTitlesPanel } from "../components/CustomerTitlesPanel";

type Customer = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  sellerId: string | null;
  seller?: { user: { name: string } } | null;
  creditLimit?: unknown;
  creditBlocked?: boolean;
  latitude?: unknown;
  longitude?: unknown;
  addressNote?: string | null;
};

type Seller = { id: string; user: { name: string } };

function customerHasMapCoords(c: Customer): boolean {
  return (
    c.latitude != null &&
    c.longitude != null &&
    String(c.latitude).trim() !== "" &&
    String(c.longitude).trim() !== ""
  );
}

export function CustomersPage() {
  const qc = useQueryClient();
  const { data: customers = [], isLoading } = useQuery({
    queryKey: ["admin", "customers"],
    queryFn: () => apiFetch<Customer[]>("/admin/customers"),
  });
  const { data: sellers = [] } = useQuery({
    queryKey: ["admin", "sellers"],
    queryFn: () => apiFetch<Seller[]>("/admin/sellers"),
  });

  const { data: pricingSettings } = useQuery({
    queryKey: ["admin", "pricing-settings"],
    queryFn: () =>
      apiFetch<{ defaultMaxSellerDiscountPercent: number; creditPolicy: string }>(
        "/admin/pricing-settings",
      ),
  });

  const patchPricing = useMutation({
    mutationFn: (creditPolicy: string) =>
      apiFetch("/admin/pricing-settings", {
        method: "PATCH",
        body: JSON.stringify({ creditPolicy }),
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["admin", "pricing-settings"] }),
  });

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [sellerId, setSellerId] = useState("");
  const [editing, setEditing] = useState<Customer | null>(null);
  const [creditLimitStr, setCreditLimitStr] = useState("");
  const [creditBlockedEdit, setCreditBlockedEdit] = useState(false);
  const [geoLatStr, setGeoLatStr] = useState("");
  const [geoLngStr, setGeoLngStr] = useState("");
  const [geoNoteStr, setGeoNoteStr] = useState("");

  const create = useMutation({
    mutationFn: () => {
      let latitude: number | undefined;
      let longitude: number | undefined;
      const lt = geoLatStr.trim();
      const lg = geoLngStr.trim();
      if (lt || lg) {
        if (!lt || !lg) throw new Error("Informe latitude e longitude, ou deixe os dois vazios.");
        latitude = Number(lt.replace(",", "."));
        longitude = Number(lg.replace(",", "."));
        if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) throw new Error("Latitude inválida.");
        if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180)
          throw new Error("Longitude inválida.");
      }
      const note = geoNoteStr.trim();
      return apiFetch("/admin/customers", {
        method: "POST",
        body: JSON.stringify({
          name,
          email: email || undefined,
          phone: phone || undefined,
          sellerId: sellerId || undefined,
          ...(latitude !== undefined && longitude !== undefined ? { latitude, longitude } : {}),
          ...(note ? { addressNote: note } : {}),
        }),
      });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "customers"] });
      setName("");
      setEmail("");
      setPhone("");
      setSellerId("");
      setGeoLatStr("");
      setGeoLngStr("");
      setGeoNoteStr("");
    },
    onError: (e: Error) => window.alert(e.message),
  });

  const update = useMutation({
    mutationFn: () => {
      let latitude: number | null | undefined = undefined;
      let longitude: number | null | undefined = undefined;
      const lt = geoLatStr.trim();
      const lg = geoLngStr.trim();
      if (!lt && !lg) {
        latitude = null;
        longitude = null;
      } else {
        if (!lt || !lg) throw new Error("Latitude e longitude devem ficar ambas preenchidas, ou ambas vazias para limpar.");
        const la = Number(lt.replace(",", "."));
        const lo = Number(lg.replace(",", "."));
        if (!Number.isFinite(la) || la < -90 || la > 90) throw new Error("Latitude inválida.");
        if (!Number.isFinite(lo) || lo < -180 || lo > 180) throw new Error("Longitude inválida.");
        latitude = la;
        longitude = lo;
      }
      const noteTrim = geoNoteStr.trim();
      return apiFetch(`/admin/customers/${editing!.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name,
          email: email || null,
          phone: phone || null,
          sellerId: sellerId || null,
          creditLimit:
            creditLimitStr.trim() === ""
              ? null
              : Number(creditLimitStr.replace(",", ".")),
          creditBlocked: creditBlockedEdit,
          latitude,
          longitude,
          addressNote: noteTrim === "" ? null : noteTrim,
        }),
      });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "customers"] });
      setEditing(null);
      setName("");
      setEmail("");
      setPhone("");
      setSellerId("");
      setCreditLimitStr("");
      setCreditBlockedEdit(false);
      setGeoLatStr("");
      setGeoLngStr("");
      setGeoNoteStr("");
    },
    onError: (e: Error) => window.alert(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => apiFetch(`/admin/customers/${id}`, { method: "DELETE" }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["admin", "customers"] }),
  });

  function startEdit(c: Customer) {
    setEditing(c);
    setName(c.name);
    setEmail(c.email ?? "");
    setPhone(c.phone ?? "");
    setSellerId(c.sellerId ?? "");
    setCreditBlockedEdit(Boolean(c.creditBlocked));
    setCreditLimitStr(
      c.creditLimit != null && c.creditLimit !== ""
        ? String(Number(c.creditLimit as string))
        : "",
    );
    setGeoLatStr(
      c.latitude != null && c.latitude !== "" ? String(Number(c.latitude as string)) : "",
    );
    setGeoLngStr(
      c.longitude != null && c.longitude !== "" ? String(Number(c.longitude as string)) : "",
    );
    setGeoNoteStr(c.addressNote ?? "");
  }

  function cancelEdit() {
    setEditing(null);
    setName("");
    setEmail("");
    setPhone("");
    setSellerId("");
    setCreditLimitStr("");
    setCreditBlockedEdit(false);
    setGeoLatStr("");
    setGeoLngStr("");
    setGeoNoteStr("");
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Clientes</h1>

      <div className="rounded-xl border border-sky-100 bg-sky-50/70 p-4">
        <h2 className="text-sm font-semibold text-sky-950">Quando o cliente está “ruim” no crédito</h2>
        <p className="mt-1 text-xs text-sky-900/80">
          Escolha se o app só avisa o vendedor, bloqueia o pedido ou envia para aprovação no escritório.
        </p>
        <label className="mt-3 flex flex-wrap items-center gap-2 text-sm text-sky-950">
          Política da empresa
          <select
            className="rounded border border-sky-200 bg-white px-2 py-1.5 text-sm"
            value={pricingSettings?.creditPolicy ?? "WARN_ONLY"}
            disabled={patchPricing.isPending || pricingSettings === undefined}
            onChange={(e) => patchPricing.mutate(e.target.value)}
          >
            <option value="WARN_ONLY">Só avisar (não bloqueia)</option>
            <option value="BLOCK_ORDER">Bloquear pedido</option>
            <option value="REQUIRE_APPROVAL">Pedir aprovação no escritório</option>
          </select>
        </label>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="font-medium">{editing ? "Editar cliente" : "Novo cliente"}</h2>
        {!editing ? (
          <div className="mt-3">
            <CnpjLookupField
              buttonLabel="Buscar empresa (CNPJ)"
              onApply={(d: CnpjCompanyData) => {
                setName(suggestedTradeName(d));
                setEmail(d.email ?? "");
                setPhone(d.telefone ?? "");
              }}
            />
          </div>
        ) : null}
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <input
            className="rounded border px-3 py-2 text-sm"
            placeholder="Nome"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            className="rounded border px-3 py-2 text-sm"
            placeholder="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            className="rounded border px-3 py-2 text-sm"
            placeholder="Telefone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <select
            className="rounded border px-3 py-2 text-sm"
            value={sellerId}
            onChange={(e) => setSellerId(e.target.value)}
          >
            <option value="">Vendedor (opcional)</option>
            {sellers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.user.name}
              </option>
            ))}
          </select>
        </div>
        <div className="mt-4 rounded-lg border border-dashed border-slate-200 bg-slate-50/90 px-3 py-3">
          <p className="text-xs font-semibold text-slate-700">Localização no mapa (app do vendedor)</p>
          <p className="mt-1 text-xs text-slate-500">
            Latitude/longitude em graus decimais (ex.: −23.5505, −46.6333). Opcional; necessário para rota e «próximos».
          </p>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            <input
              className="rounded border px-3 py-2 text-sm"
              placeholder="Latitude"
              value={geoLatStr}
              onChange={(e) => setGeoLatStr(e.target.value)}
              autoComplete="off"
            />
            <input
              className="rounded border px-3 py-2 text-sm"
              placeholder="Longitude"
              value={geoLngStr}
              onChange={(e) => setGeoLngStr(e.target.value)}
              autoComplete="off"
            />
            <input
              className="rounded border px-3 py-2 text-sm sm:col-span-3"
              placeholder="Nota de endereço / como chegar (opcional)"
              value={geoNoteStr}
              onChange={(e) => setGeoNoteStr(e.target.value)}
              autoComplete="off"
            />
          </div>
          {editing ? (
            <p className="mt-2 text-xs text-slate-500">
              Para remover coordenadas, limpe latitude e longitude e guarde.
            </p>
          ) : null}
        </div>
        {editing ? (
          <div className="mt-3 flex flex-wrap items-center gap-6 rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-3">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={creditBlockedEdit}
                onChange={(e) => setCreditBlockedEdit(e.target.checked)}
              />
              Cliente bloqueado para vendas
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-600">
              Limite de crédito (R$)
              <input
                className="w-32 rounded border px-2 py-1 text-sm"
                placeholder="vazio = sem limite"
                value={creditLimitStr}
                onChange={(e) => setCreditLimitStr(e.target.value)}
              />
            </label>
          </div>
        ) : null}
        <div className="mt-3 flex gap-2">
          {editing ? (
            <>
              <button
                type="button"
                className="rounded bg-brand-600 px-4 py-2 text-sm text-white"
                disabled={!name || update.isPending}
                onClick={() => update.mutate()}
              >
                Salvar
              </button>
              <button type="button" className="text-sm text-slate-600" onClick={cancelEdit}>
                Cancelar
              </button>
            </>
          ) : (
            <button
              type="button"
              className="rounded bg-brand-600 px-4 py-2 text-sm text-white"
              disabled={!name || create.isPending}
              onClick={() => create.mutate()}
            >
              Adicionar
            </button>
          )}
        </div>
        {editing ? <CustomerTitlesPanel customerId={editing.id} /> : null}
      </div>

      {isLoading ? (
        <p className="text-slate-500">Carregando…</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr>
                <th className="px-4 py-3">Nome</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Telefone</th>
                <th className="px-4 py-3">Vendedor</th>
                <th className="px-4 py-3">Mapa</th>
                <th className="px-4 py-3">Crédito</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c.id} className="border-t border-slate-100">
                  <td className="px-4 py-3">{c.name}</td>
                  <td className="px-4 py-3">{c.email ?? "—"}</td>
                  <td className="px-4 py-3">{c.phone ?? "—"}</td>
                  <td className="px-4 py-3">{c.seller?.user.name ?? "—"}</td>
                  <td className="px-4 py-3">
                    {customerHasMapCoords(c) ? (
                      <span className="rounded-md bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-900">
                        Sim
                      </span>
                    ) : (
                      <span className="text-slate-400">Não</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {c.creditBlocked ? (
                      <span className="rounded bg-red-100 px-2 py-0.5 text-xs font-medium text-red-900">
                        Bloqueado
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button type="button" className="text-brand-600" onClick={() => startEdit(c)}>
                      Editar
                    </button>
                    <button
                      type="button"
                      className="ml-3 text-red-600"
                      onClick={() => {
                        if (confirm("Excluir cliente?")) remove.mutate(c.id);
                      }}
                    >
                      Excluir
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
