import { ThemedButton } from "@/components/atoms/ThemedButton";
import { ThemedText } from "@/components/atoms/ThemedText";
import { ThemedTextInput } from "@/components/atoms/ThemedTextInput";
import {
  KeyboardAvoidingScreen,
  MobileHeader,
  SafeScreen,
} from "@/components/layout";
import { MOBILE_TAB_SCROLL_BOTTOM } from "@/components/layout/MobileScreen";
import { ClienteCard } from "@/components/molecules/QuickAction";
import { useCustomersScreen } from "@/hooks/screens/useCustomersScreen";
import { useTheme } from "@/lib/theme";
import {
  formatCnpjMask,
  formatCpfMask,
  formatStructuredAddress,
} from "@pedidos/shared";
import { Search, UserPlus } from "lucide-react-native";
import { useMemo, useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, View } from "react-native";

function customerSubtitle(item: {
  city?: string | null;
  state?: string | null;
  street?: string | null;
  number?: string | null;
  neighborhood?: string | null;
  cep?: string | null;
  addressNote?: string | null;
  email?: string | null;
  phone?: string | null;
  cnpj?: string | null;
  cpf?: string | null;
}): string {
  const place =
    formatStructuredAddress(item) ??
    ([item.city, item.state].filter(Boolean).join("/") || null);
  const doc = item.cnpj
    ? formatCnpjMask(item.cnpj)
    : item.cpf
      ? formatCpfMask(item.cpf)
      : null;
  if (place && doc) return `${place} · ${doc}`;
  return place ?? doc ?? item.phone ?? item.email ?? "Sem dados de contato";
}

export default function CustomersScreen() {
  const { colors } = useTheme();
  const [search, setSearch] = useState("");

  const {
    customers,
    isLoading,
    isRefetching,
    refetch,
    openCustomer,
    openNewCustomer,
  } = useCustomersScreen();

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.email?.toLowerCase().includes(q) ?? false) ||
        (c.phone?.includes(q) ?? false) ||
        (c.city?.toLowerCase().includes(q) ?? false) ||
        (c.cnpj?.includes(q) ?? false) ||
        (c.cpf?.includes(q) ?? false),
    );
  }, [customers, search]);

  const listHeader = (
    <View style={styles.header}>
      <View
        style={[
          styles.searchRow,
          {
            backgroundColor: colors.searchBackground,
            borderColor: colors.inputBorder,
          },
        ]}
      >
        <Search size={20} color={colors.iconMuted} style={{ marginRight: 8 }} />
        <ThemedTextInput
          style={styles.searchInput}
          placeholder="Buscar por nome, documento, cidade…"
          value={search}
          onChangeText={setSearch}
        />
      </View>

      <ThemedButton onPress={openNewCustomer} style={styles.newBtn}>
        <View style={styles.newBtnInner}>
          <UserPlus color={colors.primaryForeground} size={18} />
          <ThemedText
            style={{ color: colors.primaryForeground, fontWeight: "700" }}
          >
            Novo cliente
          </ThemedText>
        </View>
      </ThemedButton>
    </View>
  );

  return (
    <SafeScreen variant="tab">
      <MobileHeader
        title="Clientes"
        subtitle={`${customers.length} cadastrado${customers.length === 1 ? "" : "s"}`}
      />
      {isLoading ? (
        <ActivityIndicator style={{ marginTop: 24 }} color={colors.primary} />
      ) : (
        <KeyboardAvoidingScreen>
          <FlatList
            data={filtered}
            keyExtractor={(c) => c.id}
            refreshing={isRefetching}
            onRefresh={() => void refetch()}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            ListHeaderComponent={listHeader}
            contentContainerStyle={styles.list}
            ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
            ListEmptyComponent={
              <View style={styles.empty}>
                <ThemedText variant="body" style={{ fontWeight: "600" }}>
                  {search.trim() ? "Nenhum resultado" : "Nenhum cliente ainda"}
                </ThemedText>
                <ThemedText
                  variant="bodySm"
                  muted
                  style={{ textAlign: "center", marginTop: 6 }}
                >
                  {search.trim()
                    ? "Tente outro termo de busca."
                    : "Cadastre o primeiro cliente para começar a vender."}
                </ThemedText>
              </View>
            }
            renderItem={({ item }) => {
              const approval = item.approvalStatus;
              const statusLabel =
                approval === "PENDING"
                  ? "Aguardando validação"
                  : approval === "REJECTED"
                    ? "Cadastro rejeitado"
                    : null;
              const statusTone =
                approval === "PENDING"
                  ? ("warning" as const)
                  : approval === "REJECTED"
                    ? ("danger" as const)
                    : null;
              return (
                <ClienteCard
                  nome={item.name}
                  endereco={customerSubtitle(item)}
                  inadimplente={Boolean(item.creditBlocked)}
                  statusLabel={statusLabel}
                  statusTone={statusTone}
                  onPress={() => openCustomer(item.id)}
                />
              );
            }}
          />
        </KeyboardAvoidingScreen>
      )}
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  header: { gap: 12, paddingBottom: 10 },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
  },
  searchInput: {
    flex: 1,
    borderWidth: 0,
    backgroundColor: "transparent",
    minHeight: 48,
  },
  newBtn: { minHeight: 48 },
  newBtnInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: MOBILE_TAB_SCROLL_BOTTOM,
    paddingTop: 10,
  },
  empty: {
    alignItems: "center",
    paddingTop: 40,
    paddingHorizontal: 24,
  },
});
