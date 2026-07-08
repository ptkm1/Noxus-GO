import { formatCnpjMask, isCnpjComplete, isValidCnpj } from "@pedidos/shared";
import { Search, UserPlus } from "lucide-react-native";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { ThemedButton } from "@/components/atoms/ThemedButton";
import { ThemedCard } from "@/components/atoms/ThemedCard";
import { ThemedText } from "@/components/atoms/ThemedText";
import { ThemedTextInput } from "@/components/atoms/ThemedTextInput";
import { ClienteCard } from "@/components/molecules/QuickAction";
import { FilterChipRow } from "@/components/molecules/FilterChipRow";
import { MobileHeader } from "@/components/layout";
import { MOBILE_TAB_SCROLL_BOTTOM } from "@/components/layout/MobileScreen";
import { useCustomersScreen } from "@/hooks/screens/useCustomersScreen";
import { useTheme } from "@/lib/theme";

type Filter = "all";

export default function CustomersScreen() {
  const { colors } = useTheme();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [showForm, setShowForm] = useState(false);

  const {
    customers,
    isLoading,
    isRefetching,
    refetch,
    name,
    setName,
    email,
    setEmail,
    phone,
    setPhone,
    addressNote,
    setAddressNote,
    cnpjDigits,
    onCnpjChange,
    cnpjLoading,
    cnpjErr,
    cnpjOk,
    cnpjWarning,
    lookupCnpj,
    create,
    openCustomer,
    canSubmit,
  } = useCustomersScreen();

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.email?.toLowerCase().includes(q) ?? false) ||
        (c.phone?.includes(q) ?? false),
    );
  }, [customers, search]);

  const listHeader = (
    <View style={{ gap: 14, paddingBottom: 8 }}>
      <View style={[styles.searchRow, { backgroundColor: colors.searchBackground, borderColor: colors.inputBorder }]}>
        <Search size={20} color={colors.iconMuted} style={{ marginRight: 8 }} />
        <ThemedTextInput
          style={{ flex: 1, borderWidth: 0, backgroundColor: "transparent", minHeight: 48 }}
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

      <Pressable onPress={() => setShowForm((v) => !v)}>
        <ThemedText variant="body" style={{ color: colors.primary, fontWeight: "600" }}>
          {showForm ? "Ocultar formulário" : "+ Novo cliente"}
        </ThemedText>
      </Pressable>

      {showForm ? (
        <ThemedCard>
          <ThemedText variant="titleSm" style={{ marginBottom: 8 }}>
            Novo cliente
          </ThemedText>
          <ThemedText variant="caption" muted>
            CNPJ (opcional)
          </ThemedText>
          <View style={styles.cnpjRow}>
            <ThemedTextInput
              style={{ flex: 1, fontFamily: "monospace" }}
              placeholder="00.000.000/0001-00"
              keyboardType="number-pad"
              value={formatCnpjMask(cnpjDigits)}
              editable={!cnpjLoading}
              onChangeText={onCnpjChange}
            />
            <ThemedButton
              variant="outline"
              size="sm"
              disabled={
                !isCnpjComplete(cnpjDigits) ||
                !isValidCnpj(cnpjDigits) ||
                cnpjLoading
              }
              onPress={() => void lookupCnpj()}
            >
              {cnpjLoading ? "…" : "Buscar"}
            </ThemedButton>
          </View>
          {cnpjErr ? (
            <ThemedText variant="caption" style={{ color: colors.danger }}>
              {cnpjErr}
            </ThemedText>
          ) : null}
          {cnpjWarning ? (
            <ThemedText variant="caption" style={{ color: colors.warning, fontWeight: "600" }}>
              {cnpjWarning}
            </ThemedText>
          ) : null}
          {cnpjOk ? (
            <ThemedText variant="caption" style={{ color: colors.success }}>
              {cnpjOk}
            </ThemedText>
          ) : null}
          <ThemedTextInput placeholder="Nome" value={name} onChangeText={setName} />
          <ThemedTextInput
            placeholder="Email"
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
          />
          <ThemedTextInput placeholder="Telefone" value={phone} onChangeText={setPhone} />
          <ThemedTextInput
            placeholder="Endereço / nota (opcional)"
            value={addressNote}
            onChangeText={setAddressNote}
          />
          <ThemedButton
            disabled={!canSubmit}
            onPress={() => {
              create.mutate();
              setShowForm(false);
            }}
            style={{ marginTop: 8 }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <UserPlus color={colors.primaryForeground} size={18} />
              <ThemedText style={{ color: colors.primaryForeground, fontWeight: "600" }}>
                Adicionar
              </ThemedText>
            </View>
          </ThemedButton>
        </ThemedCard>
      ) : null}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <MobileHeader title="Clientes" subtitle={`${customers.length} cadastrados`} />
      {isLoading ? (
        <ActivityIndicator style={{ marginTop: 24 }} color={colors.primary} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(c) => c.id}
          refreshing={isRefetching}
          onRefresh={() => void refetch()}
          ListHeaderComponent={listHeader}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: MOBILE_TAB_SCROLL_BOTTOM }}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          ListEmptyComponent={
            <ThemedText variant="bodySm" muted style={{ textAlign: "center", marginTop: 24 }}>
              Nenhum cliente.
            </ThemedText>
          }
          renderItem={({ item }) => (
            <ClienteCard
              nome={item.name}
              endereco={item.email ?? item.phone ?? "Sem contacto"}
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
  cnpjRow: { flexDirection: "row", gap: 8, alignItems: "center", marginVertical: 8 },
});
