import { ThemedButton } from "@/components/atoms/ThemedButton";
import { ThemedText } from "@/components/atoms/ThemedText";
import { ThemedTextInput } from "@/components/atoms/ThemedTextInput";
import { FilterChipRow } from "@/components/molecules/FilterChipRow";
import { FormSelectField } from "@/components/molecules/FormSelectField";
import { useCepLookup } from "@/hooks/useCepLookup";
import { useIbgeMunicipios, useIbgeUfs } from "@/hooks/useIbgeLocations";
import { useTheme } from "@/lib/theme";
import type {
  CustomerDocumentType,
  CustomerFormErrors,
  CustomerFormValues,
} from "@pedidos/shared";
import {
  cepDigitsOnly,
  cnpjDigitsOnly,
  cpfDigitsOnly,
  formatCepMask,
  formatCnpjMask,
  formatCpfMask,
} from "@pedidos/shared";
import { useEffect } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";

const DOC_OPTIONS = [
  { id: "CNPJ" as CustomerDocumentType, label: "CNPJ" },
  { id: "CPF" as CustomerDocumentType, label: "CPF" },
];

type Props = {
  step: number;
  form: CustomerFormValues;
  onChange: (patch: Partial<CustomerFormValues>) => void;
  onLookupCnpj: () => void;
  cnpjLoading: boolean;
  errors?: CustomerFormErrors;
};

function FieldError({ message }: { message?: string }) {
  const { colors } = useTheme();
  if (!message) return null;
  return (
    <ThemedText variant="caption" style={{ color: colors.danger }}>
      {message}
    </ThemedText>
  );
}

export function CustomerFormWizard({
  step,
  form,
  onChange,
  onLookupCnpj,
  cnpjLoading,
  errors = {},
}: Props) {
  const { data: ufs = [] } = useIbgeUfs();
  const { data: municipios = [], isLoading: citiesLoading } = useIbgeMunicipios(
    form.state,
  );
  const { lookup, loading: cepLoading, error: cepError } = useCepLookup();

  async function onLookupCep() {
    const data = await lookup(form.cep);
    if (!data) return;
    onChange({
      cep: data.cep,
      street: data.street ?? form.street,
      neighborhood: data.neighborhood ?? form.neighborhood,
      state: data.state,
      city: data.city,
      cityIbgeCode: data.cityIbgeCode ?? form.cityIbgeCode,
    });
  }

  useEffect(() => {
    if (!form.city || municipios.length === 0) return;
    const match = municipios.find(
      (m) =>
        m.nome.localeCompare(form.city, "pt", { sensitivity: "base" }) === 0,
    );
    if (!match) return;
    const patch: Partial<CustomerFormValues> = {};
    if (match.nome !== form.city) patch.city = match.nome;
    if (!form.cityIbgeCode) patch.cityIbgeCode = String(match.id);
    if (Object.keys(patch).length > 0) onChange(patch);
  }, [municipios, form.city, form.cityIbgeCode]);

  const citySelectValue =
    municipios.find((m) => m.nome === form.city)?.nome ??
    municipios.find(
      (m) =>
        m.nome.localeCompare(form.city, "pt", { sensitivity: "base" }) === 0,
    )?.nome ??
    form.city;

  if (step === 0) {
    return (
      <View style={styles.gap}>
        <ThemedText variant="titleSm">Documento</ThemedText>
        <FilterChipRow
          options={DOC_OPTIONS}
          value={form.documentType}
          onChange={(type) =>
            onChange({
              documentType: type,
              cnpj: type === "CNPJ" ? form.cnpj : "",
              cpf: type === "CPF" ? form.cpf : "",
              legalName: type === "CNPJ" ? form.legalName : "",
              tradeName: type === "CNPJ" ? form.tradeName : "",
            })
          }
        />

        {form.documentType === "CNPJ" ? (
          <>
            <ThemedText variant="caption" muted>
              CNPJ *
            </ThemedText>
            <View style={styles.row}>
              <ThemedTextInput
                style={[styles.flex, { fontFamily: "monospace" }]}
                invalid={!!errors.cnpj}
                value={formatCnpjMask(form.cnpj)}
                onChangeText={(t) => onChange({ cnpj: cnpjDigitsOnly(t) })}
                keyboardType="number-pad"
                placeholder="00.000.000/0001-00"
              />
              <ThemedButton
                variant="secondary"
                onPress={onLookupCnpj}
                disabled={cnpjLoading}
                style={{ minWidth: 100 }}
              >
                {cnpjLoading ? "…" : "Buscar"}
              </ThemedButton>
            </View>
            <FieldError message={errors.cnpj} />
            <ThemedText variant="caption" muted>
              Razão social *
            </ThemedText>
            <ThemedTextInput
              invalid={!!errors.legalName}
              value={form.legalName}
              onChangeText={(t) => onChange({ legalName: t })}
            />
            <FieldError message={errors.legalName} />
            <ThemedText variant="caption" muted>
              Nome fantasia
            </ThemedText>
            <ThemedTextInput
              invalid={!!errors.tradeName}
              value={form.tradeName}
              onChangeText={(t) => onChange({ tradeName: t })}
            />
            <FieldError message={errors.tradeName} />
          </>
        ) : (
          <>
            <ThemedText variant="caption" muted>
              CPF *
            </ThemedText>
            <ThemedTextInput
              style={{ fontFamily: "monospace" }}
              invalid={!!errors.cpf}
              value={formatCpfMask(form.cpf)}
              onChangeText={(t) => onChange({ cpf: cpfDigitsOnly(t) })}
              keyboardType="number-pad"
              placeholder="000.000.000-00"
            />
            <FieldError message={errors.cpf} />
            <ThemedText variant="caption" muted>
              Nome completo *
            </ThemedText>
            <ThemedTextInput
              invalid={!!errors.name}
              value={form.name}
              onChangeText={(t) => onChange({ name: t })}
            />
            <FieldError message={errors.name} />
          </>
        )}
      </View>
    );
  }

  if (step === 1) {
    return (
      <View style={styles.gap}>
        <ThemedText variant="titleSm">Endereço</ThemedText>
        <ThemedText variant="caption" muted>
          CEP
        </ThemedText>
        <View style={styles.row}>
          <ThemedTextInput
            style={[styles.flex, { fontFamily: "monospace" }]}
            value={formatCepMask(cepDigitsOnly(form.cep))}
            onChangeText={(t) => onChange({ cep: cepDigitsOnly(t) })}
            keyboardType="number-pad"
          />
          <ThemedButton
            variant="secondary"
            onPress={() => void onLookupCep()}
            disabled={cepLoading}
          >
            {cepLoading ? "…" : "Buscar"}
          </ThemedButton>
        </View>
        {cepError ? (
          <ThemedText variant="caption" style={{ color: "#c00" }}>
            {cepError}
          </ThemedText>
        ) : null}
        <ThemedText variant="caption" muted>
          Endereço
        </ThemedText>
        <ThemedTextInput
          value={form.street}
          onChangeText={(t) => onChange({ street: t })}
        />
        <ThemedText variant="caption" muted>
          Bairro
        </ThemedText>
        <ThemedTextInput
          value={form.neighborhood}
          onChangeText={(t) => onChange({ neighborhood: t })}
        />
        <ThemedText variant="caption" muted>
          Número
        </ThemedText>
        <ThemedTextInput
          value={form.number}
          onChangeText={(t) => onChange({ number: t })}
        />
        <FormSelectField
          label="UF"
          value={form.state}
          options={ufs.map((u) => ({
            value: u.sigla,
            label: `${u.sigla} — ${u.nome}`,
          }))}
          onChange={(uf) => onChange({ state: uf, city: "", cityIbgeCode: "" })}
        />
        <FormSelectField
          label="Cidade"
          value={citySelectValue}
          disabled={!form.state}
          placeholder={
            form.state
              ? citiesLoading
                ? "Carregando…"
                : "Selecione"
              : "Escolha a UF primeiro"
          }
          options={municipios.map((m) => ({ value: m.nome, label: m.nome }))}
          onChange={(cityName) => {
            const m = municipios.find((x) => x.nome === cityName);
            onChange({ city: cityName, cityIbgeCode: m ? String(m.id) : "" });
          }}
        />
        <ThemedText variant="caption" muted>
          Inscrição estadual
        </ThemedText>
        <ThemedTextInput
          value={form.stateRegistration}
          onChangeText={(t) => onChange({ stateRegistration: t })}
        />
        <ThemedText variant="caption" muted>
          Cód. município
        </ThemedText>
        <ThemedTextInput value={form.cityIbgeCode} editable={false} />
      </View>
    );
  }

  return (
    <View style={styles.gap}>
      <ThemedText variant="titleSm">Contato</ThemedText>
      <ThemedText variant="caption" muted>
        Telefone
      </ThemedText>
      <ThemedTextInput
        value={form.phone}
        onChangeText={(t) => onChange({ phone: t })}
      />
      <ThemedText variant="caption" muted>
        E-mail
      </ThemedText>
      <ThemedTextInput
        invalid={!!errors.email}
        value={form.email}
        onChangeText={(t) => onChange({ email: t })}
        keyboardType="email-address"
        autoCapitalize="none"
      />
      <FieldError message={errors.email} />
      <ThemedText variant="caption" muted>
        Comprador
      </ThemedText>
      <ThemedTextInput
        value={form.buyerName}
        onChangeText={(t) => onChange({ buyerName: t })}
      />
      <ThemedText variant="caption" muted>
        Observação
      </ThemedText>
      <ThemedTextInput
        value={form.notes}
        onChangeText={(t) => onChange({ notes: t })}
        multiline
        style={{ minHeight: 80, textAlignVertical: "top" }}
      />
    </View>
  );
}

export function CustomerFormWizardLoading() {
  return <ActivityIndicator style={{ marginTop: 24 }} />;
}

const styles = StyleSheet.create({
  gap: { gap: 12 },
  row: { flexDirection: "row", gap: 8, alignItems: "center" },
  flex: { flex: 1 },
});
