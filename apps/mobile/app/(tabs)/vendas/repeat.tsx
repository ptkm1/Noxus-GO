import { ThemedText } from "@/components/atoms/ThemedText";
import { ThemedTextInput } from "@/components/atoms/ThemedTextInput";
import { MobileHeader, MobileScreen, SafeScreen } from "@/components/layout";
import {
  RecentSaleDivider,
  RecentSaleRow,
} from "@/components/molecules/RecentSaleRow";
import { useRepeatSalePickerScreen } from "@/hooks/screens/useRepeatSalePickerScreen";
import { useTheme } from "@/lib/theme";
import { radiiPx } from "@pedidos/design-tokens";
import { Search } from "lucide-react-native";
import { ActivityIndicator, StyleSheet, View } from "react-native";

export default function RepeatSalePickerScreen() {
  const { colors } = useTheme();
  const {
    search,
    setSearch,
    candidates,
    totalCandidates,
    isLoading,
    isRefetching,
    refetch,
    pickSale,
  } = useRepeatSalePickerScreen();

  return (
    <SafeScreen variant="tab">
      <MobileHeader
        title="Repetir venda"
        subtitle="Últimos 2 meses · toque para pré-preencher"
        showBack
      />
      <MobileScreen
        refreshing={isRefetching}
        onRefresh={() => void refetch()}
        contentContainerStyle={{ paddingBottom: 24 }}
      >
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
            placeholder="Buscar por nome, CNPJ, razão social, cidade…"
            value={search}
            onChangeText={setSearch}
          />
        </View>

        {isLoading ? (
          <ActivityIndicator
            color={colors.primary}
            style={{ marginVertical: 32 }}
          />
        ) : totalCandidates === 0 ? (
          <ThemedText
            variant="bodySm"
            muted
            style={{ textAlign: "center", paddingVertical: 48 }}
          >
            Nenhuma venda confirmada nos últimos 2 meses.
          </ThemedText>
        ) : candidates.length === 0 ? (
          <View style={styles.empty}>
            <ThemedText variant="body" style={{ fontWeight: "600" }}>
              Nenhum resultado
            </ThemedText>
            <ThemedText
              variant="bodySm"
              muted
              style={{ textAlign: "center", marginTop: 6 }}
            >
              Tente outro termo de busca.
            </ThemedText>
          </View>
        ) : (
          <View
            style={[
              styles.listCard,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            {candidates.map((order, index) => (
              <View key={order.id}>
                {index > 0 ? <RecentSaleDivider color={colors.border} /> : null}
                <RecentSaleRow
                  order={order}
                  onPress={() => pickSale(order.id)}
                />
              </View>
            ))}
          </View>
        )}
      </MobileScreen>
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    marginBottom: 14,
  },
  searchInput: {
    flex: 1,
    borderWidth: 0,
    backgroundColor: "transparent",
    minHeight: 48,
  },
  listCard: {
    borderRadius: radiiPx.lg,
    borderWidth: 1,
    overflow: "hidden",
    paddingVertical: 8,
  },
  empty: {
    alignItems: "center",
    paddingTop: 40,
    paddingHorizontal: 24,
  },
});
