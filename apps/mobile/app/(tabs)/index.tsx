import { fmtMoney } from "@/components/atoms/formatMoney";
import { ThemedText } from "@/components/atoms/ThemedText";
import { MobileHeader, MobileScreen, SafeScreen } from "@/components/layout";
import { HeaderIconButton } from "@/components/molecules/HeaderIconButton";
import { QuickAction } from "@/components/molecules/QuickAction";
import { RecentSalesBlock } from "@/components/molecules/RecentSalesBlock";
import { ProgressStat, StatCard } from "@/components/molecules/StatCard";
import { SyncStatusBanner } from "@/components/molecules/SyncStatusBanner";
import { TopSuppliersBlock } from "@/components/molecules/TopSuppliersBlock";
import { useAuth } from "@/context/AuthContext";
import { useSalesListScreen } from "@/hooks/screens/useSalesListScreen";
import { useNetInfoOnline } from "@/hooks/useNetInfoOnline";
import { useSyncStatusMeta } from "@/hooks/useSyncStatusMeta";
import { apiFetch } from "@/lib/api";
import {
  fetchSellerCommissionDashboard,
  sellerOfflineStaleTime,
} from "@/lib/seller-offline-queries";
import { useTheme } from "@/lib/theme";
import { colorWithAlpha } from "@/lib/theme/colorAlpha";
import { radiiPx } from "@pedidos/design-tokens";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import {
  Bell,
  ClipboardList,
  DollarSign,
  Package,
  Plus,
  ShoppingCart,
  TrendingUp,
  Users,
} from "lucide-react-native";
import { Pressable, StyleSheet, View } from "react-native";

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { colors } = useTheme();
  const isOnline = useNetInfoOnline();
  const { lastSync, lastSyncedCount } = useSyncStatusMeta();
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
    staleTime: sellerOfflineStaleTime,
    queryFn: fetchSellerCommissionDashboard,
  });

  const { data: notifications = [] } = useQuery({
    queryKey: ["seller", "notifications"],
    queryFn: () =>
      apiFetch<{ id: string; read: boolean }[]>("/seller/notifications"),
  });

  const unread = notifications.filter((n) => !n.read).length;
  const firstName = user?.name?.split(" ")[0] ?? "Vendedor";
  const initials =
    user?.name
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() ?? "?";
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
    <SafeScreen variant="tab">
      <MobileHeader
        title={`Olá, ${firstName}`}
        subtitle={today}
        leftAction={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Meu perfil"
            onPress={() => router.push("/(tabs)/profile")}
            style={[
              styles.avatarBtn,
              { backgroundColor: colorWithAlpha(colors.primary, 0.15) },
            ]}
          >
            <ThemedText
              variant="caption"
              style={{ color: colors.primary, fontWeight: "700" }}
            >
              {initials}
            </ThemedText>
          </Pressable>
        }
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
        <SyncStatusBanner
          isOnline={isOnline}
          lastSync={lastSync}
          lastSyncedCount={lastSyncedCount}
          pendingItems={pending + dead}
        />

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
              onPress={() => router.push("/(tabs)/vendas")}
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
          <QuickAction
            icon={Package}
            label="Catálogo"
            description="Consultar produtos e preços"
            onPress={() => router.push("/(tabs)/products")}
          />
          <QuickAction
            icon={TrendingUp}
            label="Comissão"
            description="Meta, ranking e extrato do mês"
            onPress={() => router.push("/(tabs)/commission")}
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
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  avatarBtn: {
    width: 40,
    height: 40,
    borderRadius: radiiPx.md,
    alignItems: "center",
    justifyContent: "center",
  },
  statGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  statCell: {
    width: "47%",
  },
});
