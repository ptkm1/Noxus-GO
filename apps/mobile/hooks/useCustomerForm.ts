import { apiFetch } from "@/lib/api";
import type {
  CnpjCompanyData,
  CustomerFormValues,
  CustomerRecord,
} from "@pedidos/shared";
import {
  cepDigitsOnly,
  cnpjDigitsOnly,
  customerToForm,
  emptyCustomerForm,
  formToCustomerPayload,
  isValidCnpj,
  suggestedTradeName,
} from "@pedidos/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Alert } from "react-native";

export function useCustomerForm(customerId?: string) {
  const router = useRouter();
  const qc = useQueryClient();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<CustomerFormValues>(emptyCustomerForm());
  const [cnpjLoading, setCnpjLoading] = useState(false);

  const { data: initial, isLoading } = useQuery({
    queryKey: ["seller", "customer", customerId],
    queryFn: () => apiFetch<CustomerRecord>(`/seller/customers/${customerId}`),
    enabled: !!customerId,
  });

  useEffect(() => {
    if (initial) setForm(customerToForm(initial));
  }, [initial]);

  const patch = useCallback((p: Partial<CustomerFormValues>) => {
    setForm((prev) => ({ ...prev, ...p }));
  }, []);

  async function lookupCnpj() {
    const d = cnpjDigitsOnly(form.cnpj);
    if (!isValidCnpj(d)) {
      Alert.alert("CNPJ inválido", "Informe um CNPJ válido com 14 dígitos.");
      return;
    }
    setCnpjLoading(true);
    try {
      const data = await apiFetch<CnpjCompanyData>(`/integrations/cnpj/${d}`, {
        skipAuth: true,
      });
      patch({
        documentType: "CNPJ",
        cnpj: d,
        legalName: data.razaoSocial ?? "",
        tradeName: data.nomeFantasia ?? "",
        name: suggestedTradeName(data),
        email: data.email ?? form.email,
        phone: data.telefone ?? form.phone,
        cep: data.cep ? cepDigitsOnly(data.cep) : form.cep,
        street: data.logradouro ?? form.street,
        number: data.numero ?? form.number,
        neighborhood: data.bairro ?? form.neighborhood,
        state: data.uf?.toUpperCase() ?? form.state,
        city: data.municipio ?? form.city,
      });
    } catch (e) {
      Alert.alert(
        "Erro",
        e instanceof Error ? e.message : "Falha na consulta.",
      );
    } finally {
      setCnpjLoading(false);
    }
  }

  const save = useMutation({
    mutationFn: async () => {
      const payload = formToCustomerPayload(form);
      if (customerId) {
        return apiFetch(`/seller/customers/${customerId}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
      }
      return apiFetch("/seller/customers", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["seller", "customers"] });
      if (customerId) {
        void qc.invalidateQueries({
          queryKey: ["seller", "customer", customerId],
        });
        router.back();
      } else {
        router.replace("/(tabs)/customers");
      }
    },
    onError: (e: Error) => Alert.alert("Erro ao salvar", e.message),
  });

  return {
    step,
    setStep,
    form,
    patch,
    lookupCnpj,
    cnpjLoading,
    isLoading: !!customerId && isLoading,
    save,
    isEdit: !!customerId,
  };
}
