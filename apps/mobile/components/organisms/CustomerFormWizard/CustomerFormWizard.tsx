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
  isStateRegistrationUnavailable,
  STATE_REGISTRATION_UNAVAILABLE,
} from "@pedidos/shared";
import { MapPin } from "lucide-react-native";
import { useEffect } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";

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
  latitude?: number | null;
  longitude?: number | null;
  onCaptureLocation?: () => void;
  locationLoading?: boolean;
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

function FieldLabel({ children }: { children: string }) {
  return (
    <ThemedText variant="caption" muted>
      {children}
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
  latitude,
  longitude,
  onCaptureLocation,
  locationLoading,
}: Props) {
  const { colors } = useTheme();
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

  const hasCoords = latitude != null && longitude != null;

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
            <FieldLabel>CNPJ *</FieldLabel>
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
                loading={cnpjLoading}
                loadingLabel="Buscando…"
                style={{ minWidth: 110 }}
              >
                Buscar
              </ThemedButton>
            </View>
            <FieldError message={errors.cnpj} />

            <FieldLabel>Razão social *</FieldLabel>
            <ThemedTextInput
              invalid={!!errors.legalName}
              value={form.legalName}
              onChangeText={(t) => onChange({ legalName: t })}
            />
            <FieldError message={errors.legalName} />

            <FieldLabel>Nome fantasia</FieldLabel>
            <ThemedTextInput
              invalid={!!errors.tradeName}
              value={form.tradeName}
              onChangeText={(t) => onChange({ tradeName: t })}
            />
            <FieldError message={errors.tradeName} />
          </>
        ) : (
          <>
            <FieldLabel>CPF *</FieldLabel>
            <ThemedTextInput
              style={{ fontFamily: "monospace" }}
              invalid={!!errors.cpf}
              value={formatCpfMask(form.cpf)}
              onChangeText={(t) => onChange({ cpf: cpfDigitsOnly(t) })}
              keyboardType="number-pad"
              placeholder="000.000.000-00"
            />
            <FieldError message={errors.cpf} />

            <FieldLabel>Nome completo *</FieldLabel>
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
        <FieldLabel>CEP</FieldLabel>
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
            loading={cepLoading}
            loadingLabel="Buscando…"
          >
            Buscar
          </ThemedButton>
        </View>
        {cepError ? (
          <ThemedText variant="caption" style={{ color: colors.danger }}>
            {cepError}
          </ThemedText>
        ) : null}

        <FieldLabel>Endereço</FieldLabel>
        <ThemedTextInput
          value={form.street}
          onChangeText={(t) => onChange({ street: t })}
        />

        <FieldLabel>Bairro</FieldLabel>
        <ThemedTextInput
          value={form.neighborhood}
          onChangeText={(t) => onChange({ neighborhood: t })}
        />

        <FieldLabel>Número</FieldLabel>
        <ThemedTextInput
          value={form.number}
          onChangeText={(t) => onChange({ number: t })}
        />

        <FieldLabel>Complemento</FieldLabel>
        <ThemedTextInput
          value={form.addressNote}
          onChangeText={(t) => onChange({ addressNote: t })}
          placeholder="Apto, sala, referência…"
        />

        <View style={styles.row}>
          <View style={styles.flex}>
            <FormSelectField
              label="UF"
              value={form.state}
              options={ufs.map((u) => ({
                value: u.sigla,
                label: `${u.sigla} — ${u.nome}`,
              }))}
              onChange={(uf) =>
                onChange({ state: uf, city: "", cityIbgeCode: "" })
              }
            />
          </View>
          <View style={[styles.flex, { flex: 1.4 }]}>
            <FormSelectField
              label="Cidade"
              value={citySelectValue}
              disabled={!form.state}
              placeholder={
                form.state
                  ? citiesLoading
                    ? "Carregando…"
                    : "Selecione"
                  : "UF primeiro"
              }
              options={municipios.map((m) => ({
                value: m.nome,
                label: m.nome,
              }))}
              onChange={(cityName) => {
                const m = municipios.find((x) => x.nome === cityName);
                onChange({
                  city: cityName,
                  cityIbgeCode: m ? String(m.id) : "",
                });
              }}
            />
          </View>
        </View>

        <FieldLabel>Inscrição estadual *</FieldLabel>
        <View
          style={[
            styles.ieField,
            {
              backgroundColor: colors.inputBackground,
              borderColor: errors.stateRegistration
                ? colors.danger
                : colors.inputBorder,
            },
          ]}
        >
          <ThemedTextInput
            style={styles.ieInput}
            invalid={!!errors.stateRegistration}
            value={
              isStateRegistrationUnavailable(form.stateRegistration)
                ? ""
                : form.stateRegistration
            }
            editable={!isStateRegistrationUnavailable(form.stateRegistration)}
            placeholder={
              isStateRegistrationUnavailable(form.stateRegistration)
                ? "indisponível"
                : "Número da IE"
            }
            onChangeText={(t) => onChange({ stateRegistration: t })}
          />
          <Pressable
            style={styles.ieCheckRow}
            onPress={() => {
              if (isStateRegistrationUnavailable(form.stateRegistration)) {
                onChange({ stateRegistration: "" });
              } else {
                onChange({
                  stateRegistration: STATE_REGISTRATION_UNAVAILABLE,
                });
              }
            }}
            accessibilityRole="checkbox"
            accessibilityState={{
              checked: isStateRegistrationUnavailable(form.stateRegistration),
            }}
          >
            <View
              style={[
                styles.ieCheckbox,
                {
                  borderColor: colors.primary,
                  backgroundColor: isStateRegistrationUnavailable(
                    form.stateRegistration,
                  )
                    ? colors.primary
                    : "transparent",
                },
              ]}
            >
              {isStateRegistrationUnavailable(form.stateRegistration) ? (
                <ThemedText
                  variant="caption"
                  style={{ color: colors.primaryForeground, fontWeight: "800" }}
                >
                  ✓
                </ThemedText>
              ) : null}
            </View>
            <ThemedText variant="caption" muted style={{ flex: 1 }}>
              Não sei a inscrição estadual
            </ThemedText>
          </Pressable>
        </View>
        <FieldError message={errors.stateRegistration} />

        <FieldLabel>Código município (IBGE)</FieldLabel>
        <ThemedTextInput
          value={form.cityIbgeCode}
          onChangeText={(t) => onChange({ cityIbgeCode: t.replace(/\D/g, "") })}
          keyboardType="number-pad"
          placeholder="Preenchido pelo CEP"
        />

        {onCaptureLocation ? (
          <View style={styles.locationBlock}>
            <ThemedButton
              variant="secondary"
              onPress={onCaptureLocation}
              loading={locationLoading}
              loadingLabel="Obtendo localização…"
            >
              <View style={styles.locationBtnInner}>
                <MapPin size={18} color={colors.primary} />
                <ThemedText variant="bodySm" style={{ fontWeight: "600" }}>
                  Usar localização atual
                </ThemedText>
              </View>
            </ThemedButton>
            {hasCoords ? (
              <ThemedText variant="caption" muted>
                GPS: {latitude!.toFixed(5)}, {longitude!.toFixed(5)}
              </ThemedText>
            ) : (
              <ThemedText variant="caption" muted>
                Opcional — grava latitude e longitude no cadastro.
              </ThemedText>
            )}
          </View>
        ) : null}
      </View>
    );
  }

  return (
    <View style={styles.gap}>
      <ThemedText variant="titleSm">Contato</ThemedText>
      <FieldLabel>Telefone</FieldLabel>
      <ThemedTextInput
        value={form.phone}
        onChangeText={(t) => onChange({ phone: t })}
        keyboardType="phone-pad"
      />

      <FieldLabel>E-mail</FieldLabel>
      <ThemedTextInput
        invalid={!!errors.email}
        value={form.email}
        onChangeText={(t) => onChange({ email: t })}
        keyboardType="email-address"
        autoCapitalize="none"
      />
      <FieldError message={errors.email} />

      <FieldLabel>Comprador</FieldLabel>
      <ThemedTextInput
        value={form.buyerName}
        onChangeText={(t) => onChange({ buyerName: t })}
      />

      <FieldLabel>Observação</FieldLabel>
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
  row: { flexDirection: "row", gap: 8, alignItems: "flex-start" },
  flex: { flex: 1 },
  locationBlock: { gap: 8, marginTop: 4 },
  locationBtnInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  ieField: {
    borderWidth: 1,
    borderRadius: 10,
    overflow: "hidden",
  },
  ieInput: {
    borderWidth: 0,
    borderRadius: 0,
    backgroundColor: "transparent",
  },
  ieCheckRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingBottom: 12,
    paddingTop: 2,
  },
  ieCheckbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
});
