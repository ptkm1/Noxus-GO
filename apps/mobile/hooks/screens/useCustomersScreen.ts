import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";
import type { CnpjCompanyData } from "@pedidos/shared";
import { cnpjDigitsOnly, suggestedTradeName } from "@pedidos/shared";
import { apiFetch } from "../../lib/api";

type Customer = { id: string; name: string; email: string | null; phone: string | null };

export function useCustomersScreen() {
  const router = useRouter();
  const qc = useQueryClient();

  const listQuery = useQuery({
    queryKey: ["seller", "customers"],
    queryFn: () => apiFetch<Customer[]>("/seller/customers"),
  });

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [cnpjDigits, setCnpjDigits] = useState("");
  const [cnpjLoading, setCnpjLoading] = useState(false);
  const [cnpjErr, setCnpjErr] = useState<string | null>(null);
  const [cnpjOk, setCnpjOk] = useState<string | null>(null);

  async function lookupCnpj() {
    const d = cnpjDigitsOnly(cnpjDigits);
    setCnpjErr(null);
    setCnpjOk(null);
    if (d.length !== 14) {
      setCnpjErr("Informe os 14 dígitos do CNPJ.");
      return;
    }
    setCnpjLoading(true);
    try {
      const data = await apiFetch<CnpjCompanyData>(`/integrations/cnpj/${d}`, { skipAuth: true });
      setName(suggestedTradeName(data));
      setEmail(data.email ?? "");
      setPhone(data.telefone ?? "");
      const trade = suggestedTradeName(data);
      setCnpjOk(`${trade}${data.situacaoCadastral ? ` · ${data.situacaoCadastral}` : ""}`);
    } catch (e) {
      setCnpjErr(e instanceof Error ? e.message : "Falha na consulta.");
    } finally {
      setCnpjLoading(false);
    }
  }

  const create = useMutation({
    mutationFn: () =>
      apiFetch("/seller/customers", {
        method: "POST",
        body: JSON.stringify({
          name,
          email: email || undefined,
          phone: phone || undefined,
        }),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["seller", "customers"] });
      setName("");
      setEmail("");
      setPhone("");
      setCnpjDigits("");
      setCnpjErr(null);
      setCnpjOk(null);
    },
  });

  function openCustomer(id: string) {
    router.push(`/customer/${id}`);
  }

  const onCnpjChange = (text: string) => setCnpjDigits(cnpjDigitsOnly(text));

  return {
    customers: listQuery.data ?? [],
    isLoading: listQuery.isLoading,
    isRefetching: listQuery.isRefetching,
    refetch: listQuery.refetch,
    name,
    setName,
    email,
    setEmail,
    phone,
    setPhone,
    cnpjDigits,
    onCnpjChange,
    cnpjLoading,
    cnpjErr,
    cnpjOk,
    lookupCnpj,
    create,
    openCustomer,
    canSubmit: Boolean(name) && !create.isPending,
  };
}
