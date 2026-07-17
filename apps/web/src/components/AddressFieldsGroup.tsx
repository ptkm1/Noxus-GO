import { FormField, FormGrid } from "@/components/forms";
import { AppSelect } from "@/components/ui/app-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCepLookup } from "@/hooks/useCepLookup";
import { useIbgeMunicipios, useIbgeUfs } from "@/hooks/useIbgeLocations";
import type { CepAddressData, CustomerFormValues } from "@pedidos/shared";
import { cepDigitsOnly, formatCepMask } from "@pedidos/shared";
import { useEffect } from "react";

type Props = {
  values: Pick<
    CustomerFormValues,
    | "cep"
    | "street"
    | "number"
    | "neighborhood"
    | "state"
    | "city"
    | "cityIbgeCode"
    | "stateRegistration"
  >;
  onChange: (patch: Partial<CustomerFormValues>) => void;
};

export function AddressFieldsGroup({ values, onChange }: Props) {
  const { data: ufs = [], isLoading: ufsLoading } = useIbgeUfs();
  const { data: municipios = [], isLoading: citiesLoading } = useIbgeMunicipios(
    values.state,
  );
  const { lookup, loading: cepLoading, error: cepError } = useCepLookup();

  async function onLookupCep() {
    const data = await lookup(values.cep);
    if (!data) return;
    applyCep(data);
  }

  function applyCep(data: CepAddressData) {
    onChange({
      cep: data.cep,
      street: data.street ?? values.street,
      neighborhood: data.neighborhood ?? values.neighborhood,
      state: data.state,
      city: data.city,
      cityIbgeCode: data.cityIbgeCode ?? values.cityIbgeCode,
    });
  }

  function onStateChange(uf: string) {
    onChange({ state: uf, city: "", cityIbgeCode: "" });
  }

  function onCityChange(cityName: string) {
    const m = municipios.find((x) => x.nome === cityName);
    onChange({
      city: cityName,
      cityIbgeCode: m ? String(m.id) : "",
    });
  }

  useEffect(() => {
    if (!values.city || municipios.length === 0) return;
    const match = municipios.find(
      (m) =>
        m.nome.localeCompare(values.city, "pt", { sensitivity: "base" }) === 0,
    );
    if (!match) return;
    const patch: Partial<CustomerFormValues> = {};
    if (match.nome !== values.city) patch.city = match.nome;
    if (!values.cityIbgeCode) patch.cityIbgeCode = String(match.id);
    if (Object.keys(patch).length > 0) onChange(patch);
  }, [municipios, values.city, values.cityIbgeCode]);

  const citySelectValue =
    municipios.find((m) => m.nome === values.city)?.nome ??
    municipios.find(
      (m) =>
        m.nome.localeCompare(values.city, "pt", { sensitivity: "base" }) === 0,
    )?.nome ??
    values.city;

  return (
    <div className="space-y-4">
      <FormField label="CEP" htmlFor="cust-cep">
        <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
          <Input
            id="cust-cep"
            inputMode="numeric"
            placeholder="00000-000"
            className="font-mono"
            value={formatCepMask(cepDigitsOnly(values.cep))}
            onChange={(e) => onChange({ cep: cepDigitsOnly(e.target.value) })}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void onLookupCep();
              }
            }}
          />
          <Button
            type="button"
            variant="outline"
            disabled={cepLoading}
            onClick={() => void onLookupCep()}
          >
            {cepLoading ? "Buscando…" : "Buscar CEP"}
          </Button>
        </div>
        {cepError ? (
          <p className="text-sm text-destructive">{cepError}</p>
        ) : null}
      </FormField>

      <FormGrid cols={2}>
        <FormField
          label="Endereço"
          htmlFor="cust-street"
          className="sm:col-span-2"
        >
          <Input
            id="cust-street"
            value={values.street}
            onChange={(e) => onChange({ street: e.target.value })}
          />
        </FormField>
        <FormField label="Bairro" htmlFor="cust-neighborhood">
          <Input
            id="cust-neighborhood"
            value={values.neighborhood}
            onChange={(e) => onChange({ neighborhood: e.target.value })}
          />
        </FormField>
        <FormField label="Número" htmlFor="cust-number">
          <Input
            id="cust-number"
            value={values.number}
            onChange={(e) => onChange({ number: e.target.value })}
          />
        </FormField>
        <FormField label="UF" htmlFor="cust-uf">
          <AppSelect
            id="cust-uf"
            value={values.state}
            emptyLabel="Selecione"
            placeholder={ufsLoading ? "Carregando…" : "Selecione"}
            options={ufs.map((u) => ({
              value: u.sigla,
              label: `${u.sigla} — ${u.nome}`,
            }))}
            onValueChange={onStateChange}
          />
        </FormField>
        <FormField label="Cidade" htmlFor="cust-city">
          <AppSelect
            id="cust-city"
            value={citySelectValue}
            disabled={!values.state}
            emptyLabel={values.state ? "Selecione" : "Escolha a UF primeiro"}
            placeholder={
              !values.state
                ? "Escolha a UF primeiro"
                : citiesLoading
                  ? "Carregando…"
                  : "Selecione"
            }
            options={municipios.map((m) => ({ value: m.nome, label: m.nome }))}
            onValueChange={onCityChange}
          />
        </FormField>
        <FormField label="Inscrição estadual" htmlFor="cust-ie">
          <Input
            id="cust-ie"
            value={values.stateRegistration}
            onChange={(e) => onChange({ stateRegistration: e.target.value })}
          />
        </FormField>
        <FormField
          label="Cód. município"
          htmlFor="cust-ibge"
          hint="Preenchido ao escolher a cidade"
        >
          <Input
            id="cust-ibge"
            readOnly
            className="bg-muted"
            value={values.cityIbgeCode}
          />
        </FormField>
      </FormGrid>
    </div>
  );
}
