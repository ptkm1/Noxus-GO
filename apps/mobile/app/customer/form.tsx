import { ThemedButton } from "@/components/atoms/ThemedButton";
import { ThemedText } from "@/components/atoms/ThemedText";
import { MobileHeader, MobileScreen } from "@/components/layout";
import {
  CustomerFormWizard,
  CustomerFormWizardLoading,
} from "@/components/organisms/CustomerFormWizard";
import { useCustomerForm } from "@/hooks/useCustomerForm";
import { useTheme } from "@/lib/theme";
import {
  customerFormErrorStep,
  validateCustomerForm,
  validateCustomerFormStep,
} from "@pedidos/shared";
import { useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { KeyboardAvoidingView, Platform, View } from "react-native";

const STEP_TITLES = ["Documento", "Endereço", "Contato"];

export default function CustomerFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const customerId = typeof id === "string" && id.length > 0 ? id : undefined;
  const { colors } = useTheme();
  const {
    step,
    setStep,
    form,
    patch,
    lookupCnpj,
    cnpjLoading,
    isLoading,
    save,
    isEdit,
  } = useCustomerForm(customerId);

  const [showValidation, setShowValidation] = useState(false);
  const isLast = step === 2;

  const visibleErrors = useMemo(() => {
    if (!showValidation) return {};
    if (isLast) return validateCustomerForm(form);
    return validateCustomerFormStep(step, form);
  }, [showValidation, isLast, step, form]);

  function onContinue() {
    const stepErrors = validateCustomerFormStep(step, form);
    if (Object.keys(stepErrors).length > 0) {
      setShowValidation(true);
      return;
    }
    setShowValidation(false);
    setStep(step + 1);
  }

  function onSave() {
    const allErrors = validateCustomerForm(form);
    if (Object.keys(allErrors).length > 0) {
      setShowValidation(true);
      setStep(customerFormErrorStep(allErrors));
      return;
    }
    save.mutate();
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <MobileHeader
        title={isEdit ? "Editar cliente" : "Pré-cadastro"}
        subtitle={`Passo ${step + 1} de 3 · ${STEP_TITLES[step]}`}
        showBack
      />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <MobileScreen contentContainerStyle={{ gap: 20, paddingBottom: 32 }}>
          {isLoading ? (
            <CustomerFormWizardLoading />
          ) : (
            <CustomerFormWizard
              step={step}
              form={form}
              onChange={patch}
              onLookupCnpj={() => void lookupCnpj()}
              cnpjLoading={cnpjLoading}
              errors={visibleErrors}
            />
          )}

          <View style={{ flexDirection: "row", gap: 12, marginTop: 8 }}>
            {step > 0 ? (
              <ThemedButton
                variant="secondary"
                style={{ flex: 1 }}
                onPress={() => setStep(step - 1)}
              >
                Voltar
              </ThemedButton>
            ) : null}
            {!isLast ? (
              <ThemedButton style={{ flex: 1 }} onPress={onContinue}>
                Continuar
              </ThemedButton>
            ) : (
              <ThemedButton
                style={{ flex: 1 }}
                disabled={save.isPending}
                onPress={onSave}
              >
                {save.isPending ? "Salvando…" : isEdit ? "Salvar" : "Cadastrar"}
              </ThemedButton>
            )}
          </View>

          {!isLast ? (
            <ThemedText variant="caption" muted style={{ textAlign: "center" }}>
              Você pode revisar tudo no último passo antes de salvar.
            </ThemedText>
          ) : null}
        </MobileScreen>
      </KeyboardAvoidingView>
    </View>
  );
}
