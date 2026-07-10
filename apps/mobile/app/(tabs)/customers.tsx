import { ThemedButton } from "@/components/atoms/ThemedButton";
import { ThemedText } from "@/components/atoms/ThemedText";
import { ThemedTextInput } from "@/components/atoms/ThemedTextInput";
import { MobileHeader } from "@/components/layout";
import { MOBILE_TAB_SCROLL_BOTTOM } from "@/components/layout/MobileScreen";
import { FilterChipRow } from "@/components/molecules/FilterChipRow";
import { ClienteCard } from "@/components/molecules/QuickAction";
import { useCustomersScreen } from "@/hooks/screens/useCustomersScreen";
import { useTheme } from "@/lib/theme";
import { Search, UserPlus } from "lucide-react-native";
import { useMemo, useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, View } from "react-native";

type Filter = "all";

export default function CustomersScreen() {
  const { colors } = useTheme();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

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
    <View style={{ gap: 14, paddingBottom: 8 }}>
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
          style={{
            flex: 1,
            borderWidth: 0,
            backgroundColor: "transparent",
            minHeight: 48,
          }}
          placeholder="Buscar cliente…"
          value={search}
          onChangeText={setSearch}
        />
      </View>

      <FilterChipRow
        options={[{ id: "all" as Filter, label: "Todos" }]}
        value={filter}
        onChange={setFilter}
      />

      <ThemedButton onPress={openNewCustomer}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <UserPlus color={colors.primaryForeground} size={18} />
          <ThemedText
            style={{ color: colors.primaryForeground, fontWeight: "600" }}
          >
            Novo cliente
          </ThemedText>
        </View>
      </ThemedButton>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <MobileHeader
        title="Clientes"
        subtitle={`${customers.length} cadastrados`}
      />
      {isLoading ? (
        <ActivityIndicator style={{ marginTop: 24 }} color={colors.primary} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(c) => c.id}
          refreshing={isRefetching}
          onRefresh={() => void refetch()}
          ListHeaderComponent={listHeader}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingBottom: MOBILE_TAB_SCROLL_BOTTOM,
            paddingTop: 10,
          }}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          ListEmptyComponent={
            <ThemedText
              variant="bodySm"
              muted
              style={{ textAlign: "center", marginTop: 24 }}
            >
              Nenhum cliente.
            </ThemedText>
          }
          renderItem={({ item }) => (
            <ClienteCard
              nome={item.name}
              endereco={
                item.city && item.state
                  ? `${item.city}/${item.state}`
                  : (item.addressNote ??
                    item.email ??
                    item.phone ??
                    "Sem contacto")
              }
              onPress={() => openCustomer(item.id)}
            />
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
  },
});
