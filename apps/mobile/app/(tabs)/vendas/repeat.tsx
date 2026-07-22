import { ThemedText } from "@/components/atoms/ThemedText";
import { MobileHeader, MobileScreen, SafeScreen } from "@/components/layout";
import {
  RecentSaleDivider,
  RecentSaleRow,
} from "@/components/molecules/RecentSaleRow";
import { useRepeatSalePickerScreen } from "@/hooks/screens/useRepeatSalePickerScreen";
import { useTheme } from "@/lib/theme";
import { radiiPx } from "@pedidos/design-tokens";
import { ActivityIndicator, StyleSheet, View } from "react-native";

export default function RepeatSalePickerScreen() {
  const { colors } = useTheme();
  const { candidates, isLoading, isRefetching, refetch, pickSale } =
    useRepeatSalePickerScreen();

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
        {isLoading ? (
          <ActivityIndicator
            color={colors.primary}
            style={{ marginVertical: 32 }}
          />
        ) : candidates.length === 0 ? (
          <ThemedText
            variant="bodySm"
            muted
            style={{ textAlign: "center", paddingVertical: 48 }}
          >
            Nenhuma venda confirmada nos últimos 2 meses.
          </ThemedText>
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
  listCard: {
    borderRadius: radiiPx.lg,
    borderWidth: 1,
    overflow: "hidden",
    paddingVertical: 8,
  },
});
