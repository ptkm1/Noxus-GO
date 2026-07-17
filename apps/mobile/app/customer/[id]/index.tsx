import { ThemedButton } from "@/components/atoms/ThemedButton";
import { ThemedCard } from "@/components/atoms/ThemedCard";
import { ThemedText } from "@/components/atoms/ThemedText";
import { MobileHeader, MobileScreen } from "@/components/layout";
import { apiFetch } from "@/lib/api";
import { useTheme } from "@/lib/theme";
import type { CustomerRecord } from "@pedidos/shared";
import { formatCnpjMask, formatCpfMask } from "@pedidos/shared";
import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ActivityIndicator, View } from "react-native";

function formatDoc(c: CustomerRecord): string {
  if (c.cnpj) return formatCnpjMask(c.cnpj);
  if (c.cpf) return formatCpfMask(c.cpf);
  return "—";
}

export default function CustomerHubScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();

  const { data: customer, isLoading } = useQuery({
    queryKey: ["seller", "customer", id],
    queryFn: () => apiFetch<CustomerRecord>(`/seller/customers/${id}`),
    enabled: !!id,
  });

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <MobileHeader
        title={customer?.name ?? "Cliente"}
        subtitle="Dados cadastrais"
        showBack
      />
      <MobileScreen contentContainerStyle={{ gap: 16 }}>
        {isLoading || !customer ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <>
            <ThemedCard>
              <ThemedText variant="titleSm">{customer.name}</ThemedText>
              <ThemedText variant="bodySm" muted style={{ marginTop: 6 }}>
                {formatDoc(customer)}
              </ThemedText>
              {customer.city || customer.state ? (
                <ThemedText variant="bodySm" muted>
                  {[customer.city, customer.state].filter(Boolean).join(" / ")}
                </ThemedText>
              ) : null}
              {customer.phone ? (
                <ThemedText variant="bodySm" muted>
                  {customer.phone}
                </ThemedText>
              ) : null}
              {customer.email ? (
                <ThemedText variant="bodySm" muted>
                  {customer.email}
                </ThemedText>
              ) : null}
            </ThemedCard>

            <ThemedButton
              onPress={() => router.push(`/customer/form?id=${id}`)}
            >
              Editar cadastro
            </ThemedButton>
            <ThemedButton
              variant="secondary"
              onPress={() => router.push(`/customer/${id}/credit`)}
            >
              Crédito e títulos
            </ThemedButton>
            <ThemedButton
              variant="secondary"
              onPress={() =>
                router.push({
                  pathname: "/quick-sale",
                  params: { customerId: id },
                })
              }
            >
              Fazer pedido
            </ThemedButton>
          </>
        )}
      </MobileScreen>
    </View>
  );
}
