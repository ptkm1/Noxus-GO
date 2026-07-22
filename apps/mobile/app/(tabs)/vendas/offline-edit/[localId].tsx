import { ThemedButton } from "@/components/atoms/ThemedButton";
import { ThemedCard } from "@/components/atoms/ThemedCard";
import { ThemedText } from "@/components/atoms/ThemedText";
import { fmtMoney } from "@/components/atoms/formatMoney";
import { MobileHeader, MobileScreen, SafeScreen } from "@/components/layout";
import { useOfflineEditScreen } from "@/hooks/screens/useOfflineEditScreen";
import { useTheme } from "@/lib/theme";
import { useLocalSearchParams } from "expo-router";
import { Minus, Plus } from "lucide-react-native";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
} from "react-native";

export default function OfflineEditScreen() {
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ localId: string }>();
  const localId = typeof params.localId === "string" ? params.localId : "";
  const s = useOfflineEditScreen(localId);

  return (
    <SafeScreen variant="tab">
      <MobileHeader
        title="Editar pedido (antes do envio)"
        subtitle={s.customerLabel ?? "Fila offline"}
        showBack
      />
      <MobileScreen scroll noBottomInset>
        {s.loading ? (
          <ActivityIndicator color={colors.primary} />
        ) : s.loadError ? (
          <ThemedText variant="bodySm" style={{ color: colors.danger }}>
            {s.loadError}
          </ThemedText>
        ) : (
          <>
            <ThemedText variant="bodySm" muted>
              Só é possível editar enquanto o pedido estiver na fila. Depois de
              sincronizar, a venda fica confirmada e não pode mais ser alterada
              aqui.
            </ThemedText>

            {s.lines.length === 0 ? (
              <ThemedText variant="bodySm" muted>
                Nenhum item. Apague o pedido na fila ou volte sem salvar.
              </ThemedText>
            ) : (
              s.lines.map((line) => {
                const disc =
                  Math.min(100, Math.max(0, line.discountPercent)) / 100;
                const lineTotal =
                  line.unitPrice * line.quantity * (1 - disc);
                return (
                  <ThemedCard key={line.productId}>
                    <ThemedText
                      variant="body"
                      style={{ fontWeight: "600", marginBottom: 4 }}
                    >
                      {line.name}
                    </ThemedText>
                    <ThemedText variant="caption" muted>
                      R$ {fmtMoney(line.unitPrice)}
                      {line.discountPercent > 0
                        ? ` · −${line.discountPercent}%`
                        : ""}
                      {" · "}Subtotal R$ {fmtMoney(lineTotal)}
                    </ThemedText>
                    <View style={styles.rowActions}>
                      <View style={styles.qtyRow}>
                        <Pressable
                          hitSlop={8}
                          style={styles.iconBtn}
                          onPress={() =>
                            s.setQty(line.productId, line.quantity - 1)
                          }
                        >
                          <Minus
                            size={20}
                            color={colors.text}
                            strokeWidth={2.5}
                          />
                        </Pressable>
                        <ThemedText style={styles.qtyTxt}>
                          {line.quantity}
                        </ThemedText>
                        <Pressable
                          hitSlop={8}
                          style={styles.iconBtn}
                          onPress={() =>
                            s.setQty(line.productId, line.quantity + 1)
                          }
                        >
                          <Plus
                            size={20}
                            color={colors.text}
                            strokeWidth={2.5}
                          />
                        </Pressable>
                      </View>
                      <Pressable
                        onPress={() => s.removeLine(line.productId)}
                        hitSlop={8}
                      >
                        <ThemedText
                          style={{ color: colors.danger, fontWeight: "600" }}
                        >
                          Remover
                        </ThemedText>
                      </Pressable>
                    </View>
                  </ThemedCard>
                );
              })
            )}

            <ThemedText
              variant="body"
              style={{ fontWeight: "700", marginTop: 8 }}
            >
              Total R$ {fmtMoney(s.cartTotal)}
            </ThemedText>

            <ThemedButton
              loading={s.saving}
              loadingLabel="Salvando…"
              disabled={s.lines.length === 0}
              onPress={() => void s.save()}
            >
              Salvar alterações
            </ThemedButton>
          </>
        )}
      </MobileScreen>
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  rowActions: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  qtyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  iconBtn: {
    padding: 4,
  },
  qtyTxt: {
    minWidth: 28,
    textAlign: "center",
    fontWeight: "700",
    fontSize: 16,
  },
});
