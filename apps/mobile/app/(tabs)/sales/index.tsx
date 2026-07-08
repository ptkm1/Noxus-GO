import { fmtMoney } from "@/components/atoms/formatMoney";
import { ThemedText } from "@/components/atoms/ThemedText";
import { MobileHeader, MobileScreen } from "@/components/layout";
import { HeaderIconButton } from "@/components/molecules/HeaderIconButton";
import { QuickAction } from "@/components/molecules/QuickAction";
import { ProgressStat, StatCard } from "@/components/molecules/StatCard";
import { SyncStatusBanner } from "@/components/molecules/SyncStatusBanner";
import { TopSuppliersBlock } from "@/components/molecules/TopSuppliersBlock";
import { RecentSalesBlock } from "@/components/molecules/RecentSalesBlock";
import { useAuth } from "@/context/AuthContext";
import type { CommissionDashboard } from "@/hooks/screens/useCommissionScreen";
import { useSalesListScreen } from "@/hooks/screens/useSalesListScreen";
import { apiFetch } from "@/lib/api";
import { useTheme } from "@/lib/theme";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import {
  Bell,
  ClipboardList,
  DollarSign,
  Plus,
  ShoppingCart,
  TrendingUp,
  Users,
} from "lucide-react-native";
import { StyleSheet, View } from "react-native";

export default function SalesListScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { colors } = useTheme();
  const {
    orders,
    isLoading,
    isRefetching,
    refetch,
    pending,
    dead,
    goQuickSale,
    goOfflineQueue,
  } = useSalesListScreen();

  const { data: commission, isLoading: commissionLoading } = useQuery({
    queryKey: ["seller", "commission-dashboard"],
    queryFn: () =>
      apiFetch<CommissionDashboard>("/seller/commission-dashboard"),
  });

  const { data: notifications = [] } = useQuery({
    queryKey: ["seller", "notifications"],
    queryFn: () =>
      apiFetch<{ id: string; read: boolean }[]>("/seller/notifications"),
  });

  const unread = notifications.filter((n) => !n.read).length;
  const firstName = user?.name?.split(" ")[0] ?? "Vendedor";
  const today = new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const todayTotal = orders
    .filter((o) => {
      const d = new Date(o.createdAt);
      const n = new Date();
      return d.toDateString() === n.toDateString() && o.status === "CONFIRMED";
    })
    .reduce((s, o) => s + Number(o.totalAmount), 0);

  const goal = commission?.goal;
  const mtd = commission?.mtd.confirmedRevenue ?? 0;
  const goalTarget = goal?.targetAmount ?? 0;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <MobileHeader
        title={`Olá, ${firstName}`}
        subtitle={today}
        rightAction={
          <HeaderIconButton
            badge={unread}
            onPress={() => router.push("/(tabs)/notifications")}
          >
            <Bell color={colors.text} size={20} />
          </HeaderIconButton>
        }
      />
      <MobileScreen
        refreshing={isRefetching}
        onRefresh={() => void refetch()}
        contentContainerStyle={{ gap: 20 }}
      >
        <SyncStatusBanner isOnline pendingItems={pending + dead} />

        {goalTarget > 0 ? (
          <ProgressStat
            title={goal?.title ?? "Meta do mês"}
            current={mtd}
            target={goalTarget}
            formatValue={(v) => `R$ ${fmtMoney(v)}`}
          />
        ) : null}

        <View style={styles.statGrid}>
          <View style={styles.statCell}>
            <StatCard
              title="Vendas hoje"
              value={`R$ ${fmtMoney(todayTotal)}`}
              icon={DollarSign}
            />
          </View>
          <View style={styles.statCell}>
            <StatCard
              title="Comissão MTD"
              value={
                commissionLoading
                  ? "…"
                  : `R$ ${fmtMoney(commission?.mtd.commissionRecorded ?? 0)}`
              }
              icon={TrendingUp}
              onPress={() => router.push("/(tabs)/commission")}
            />
          </View>
          <View style={styles.statCell}>
            <StatCard
              title="Pedidos"
              value={orders.length}
              icon={ShoppingCart}
            />
          </View>
          <View style={styles.statCell}>
            <StatCard
              title="Pendentes sync"
              value={pending + dead}
              icon={Users}
              onPress={pending + dead > 0 ? goOfflineQueue : undefined}
            />
          </View>
        </View>

        <TopSuppliersBlock />

        <View style={{ gap: 10 }}>
          <ThemedText variant="titleSm">Ações rápidas</ThemedText>
          <QuickAction
            icon={Plus}
            label="Nova venda"
            description="Montar pedido com cliente e carrinho"
            variant="primary"
            onPress={goQuickSale}
          />
          {(pending > 0 || dead > 0) && (
            <QuickAction
              icon={ClipboardList}
              label="Fila offline"
              description={`${pending} pendente(s)${dead > 0 ? ` · ${dead} com erro` : ""}`}
              variant="warning"
              badge={pending + dead}
              onPress={goOfflineQueue}
            />
          )}
        </View>

        <RecentSalesBlock
          orders={orders}
          isLoading={isLoading}
          isRefetching={isRefetching && !isLoading}
        />
      </MobileScreen>
    </View>
  );
}

const styles = StyleSheet.create({
  statGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  statCell: {
    width: "47%",
  },
});
