import { ThemedText } from "@/components/atoms/ThemedText";
import { MobileHeader, MobileScreen, SafeScreen } from "@/components/layout";
import {
  RecentSaleDivider,
  RecentSaleRow,
} from "@/components/molecules/RecentSaleRow";
import { useSalesListScreen } from "@/hooks/screens/useSalesListScreen";
import { useTheme } from "@/lib/theme";
import { radiiPx } from "@pedidos/design-tokens";
import { ActivityIndicator, StyleSheet, View } from "react-native";

export default function VendasListScreen() {
  const { colors } = useTheme();
  const { orders, isLoading, isRefetching, refetch } = useSalesListScreen();

  return (
    <SafeScreen variant="tab">
      <MobileHeader
        title="Vendas"
        subtitle={`${orders.length} pedido${orders.length === 1 ? "" : "s"}`}
      />
      <MobileScreen
        refreshing={isRefetching}
        onRefresh={() => void refetch()}
        contentContainerStyle={{ paddingBottom: 24 }}
      >
        {isLoading ? (
          <ActivityIndicator
            color={colors.primary}
            style={{ marginVertical: 32 }}
          />
        ) : orders.length === 0 ? (
          <ThemedText
            variant="bodySm"
            muted
            style={{ textAlign: "center", paddingVertical: 48 }}
          >
            Nenhuma venda registrada ainda.
          </ThemedText>
        ) : (
          <View
            style={[
              styles.listCard,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            {orders.map((order, index) => (
              <View key={order.id}>
                {index > 0 ? <RecentSaleDivider color={colors.border} /> : null}
                <RecentSaleRow order={order} />
              </View>
            ))}
          </View>
        )}
      </MobileScreen>
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  listCard: {
    borderRadius: radiiPx.lg,
    borderWidth: 1,
    overflow: "hidden",
    paddingVertical: 8,
  },
});
