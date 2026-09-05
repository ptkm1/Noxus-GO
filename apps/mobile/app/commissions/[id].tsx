import { fmtMoney } from "@/components/atoms/formatMoney";
import { ThemedCard } from "@/components/atoms/ThemedCard";
import { ThemedText } from "@/components/atoms/ThemedText";
import { MobileHeader, MobileScreen, SafeScreen } from "@/components/layout";
import { apiFetch } from "@/lib/api";
import { useTheme } from "@/lib/theme";
import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { ActivityIndicator, StyleSheet, View } from "react-native";

type CommissionDetail = {
  orderId: string; orderNumber: number | null; createdAt: string; customerName: string;
  saleAmount: number; commissionPercent: number; commissionAmount: number;
  items: Array<{ productName: string; quantity: number; unitPrice: number; commissionPercent: number; commissionAmount: number }>;
};

export default function CommissionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const query = useQuery({ queryKey: ["seller", "commission", id], enabled: Boolean(id), queryFn: () => apiFetch<CommissionDetail>(`/seller/commissions/${id}`) });
  const row = query.data;
  return <SafeScreen variant="tab"><MobileHeader title="Detalhe da comissão" subtitle={row ? `Pedido #${row.orderNumber ?? row.orderId.slice(-6)}` : "Carregando pedido…"} showBack />
    <MobileScreen contentContainerStyle={{ gap: 14, paddingBottom: 32 }}>
      {query.isLoading ? <ActivityIndicator color={colors.primary} /> : null}
      {row ? <><ThemedCard><View style={styles.head}><ThemedText variant="titleSm">R$ {fmtMoney(row.commissionAmount)}</ThemedText><ThemedText style={{ color: colors.success, fontWeight: "700" }}>{row.commissionPercent.toFixed(2)}%</ThemedText></View><ThemedText variant="bodySm" muted style={{ marginTop: 6 }}>{row.customerName} · {new Date(row.createdAt).toLocaleDateString("pt-BR")}</ThemedText><ThemedText variant="bodySm" muted style={{ marginTop: 6 }}>Venda total: R$ {fmtMoney(row.saleAmount)}</ThemedText></ThemedCard><ThemedText variant="titleSm">Itens do pedido</ThemedText>{row.items.map((item, index) => <ThemedCard key={`${item.productName}-${index}`}><View style={styles.head}><ThemedText variant="body" style={{ fontWeight: "700", flex: 1 }}>{item.productName}</ThemedText><ThemedText style={{ color: colors.success, fontWeight: "700" }}>R$ {fmtMoney(item.commissionAmount)}</ThemedText></View><ThemedText variant="bodySm" muted style={{ marginTop: 6 }}>{item.quantity} × R$ {fmtMoney(item.unitPrice)} · Comissão: {item.commissionPercent.toFixed(2)}%</ThemedText></ThemedCard>)}</> : null}
      {query.error ? <ThemedText style={{ color: colors.danger, textAlign: "center" }}>{query.error instanceof Error ? query.error.message : "Não foi possível carregar o pedido."}</ThemedText> : null}
    </MobileScreen></SafeScreen>;
}
const styles = StyleSheet.create({ head: { flexDirection: "row", justifyContent: "space-between", gap: 12, alignItems: "flex-start" } });
