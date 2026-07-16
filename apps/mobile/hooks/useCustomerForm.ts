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
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Alert } from "react-native";

function parseCoord(value: unknown): number | null {
  if (value == null) return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

export function useCustomerForm(customerId?: string) {
  const router = useRouter();
  const qc = useQueryClient();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<CustomerFormValues>(emptyCustomerForm());
  const [cnpjLoading, setCnpjLoading] = useState(false);
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);

  const { data: initial, isLoading } = useQuery({
    queryKey: ["seller", "customer", customerId],
    queryFn: () => apiFetch<CustomerRecord>(`/seller/customers/${customerId}`),
    enabled: !!customerId,
  });

  useEffect(() => {
    setStep(0);
    if (!customerId) {
      setForm(emptyCustomerForm());
      setLatitude(null);
      setLongitude(null);
    }
  }, [customerId]);

  useEffect(() => {
    if (!initial) return;
    setForm(customerToForm(initial));
    setLatitude(parseCoord(initial.latitude));
    setLongitude(parseCoord(initial.longitude));
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

  const captureLocation = useCallback(async () => {
    setLocationLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permissão necessária",
          "Ative a localização para gravar as coordenadas do cliente.",
        );
        return;
      }
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setLatitude(pos.coords.latitude);
      setLongitude(pos.coords.longitude);
    } catch (e) {
      Alert.alert(
        "Localização",
        e instanceof Error ? e.message : "Não foi possível obter o GPS.",
      );
    } finally {
      setLocationLoading(false);
    }
  }, []);

  const save = useMutation({
    mutationFn: async () => {
      const payload = formToCustomerPayload(form, {
        latitude,
        longitude,
      });
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
    latitude,
    longitude,
    captureLocation,
    locationLoading,
  };
}
