import { fmtMoney } from "@/components/atoms/formatMoney";
import { ThemedButton } from "@/components/atoms/ThemedButton";
import { ThemedCard } from "@/components/atoms/ThemedCard";
import { ThemedText } from "@/components/atoms/ThemedText";
import { ThemedTextInput } from "@/components/atoms/ThemedTextInput";
import { KeyboardForm, MobileHeader, SafeScreen } from "@/components/layout";
import { MOBILE_TAB_SCROLL_BOTTOM } from "@/components/layout/MobileScreen";
import { DevToolsVersionTap } from "@/components/molecules/DevToolsVersionTap";
import { ProgressStat } from "@/components/molecules/StatCard";
import { SyncStatusBanner } from "@/components/molecules/SyncStatusBanner";
import { useProfileScreen } from "@/hooks/screens/useProfileScreen";
import { useLogout } from "@/hooks/useLogout";
import { useNetInfoOnline } from "@/hooks/useNetInfoOnline";
import { useSyncStatusMeta } from "@/hooks/useSyncStatusMeta";
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
  ChevronRight,
  Database,
  HelpCircle,
  LogOut,
  Package,
  Server,
  Settings,
  Shield,
  ShoppingBag,
  Smartphone,
  TrendingUp,
} from "lucide-react-native";
import { Pressable, StyleSheet, View } from "react-native";

function MenuRow({
  icon: Icon,
  label,
  onPress,
}: {
  icon: typeof Settings;
  label: string;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        menuStyles.row,
        { borderColor: colors.border, opacity: pressed ? 0.88 : 1 },
      ]}
    >
      <Icon color={colors.iconMuted} size={20} />
      <ThemedText variant="body" style={{ flex: 1, fontWeight: "500" }}>
        {label}
      </ThemedText>
      <ChevronRight color={colors.iconMuted} size={20} />
    </Pressable>
  );
}

const menuStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
  },
});

export default function ProfileScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const isOnline = useNetInfoOnline();
  const { lastSync, lastSyncedCount } = useSyncStatusMeta();
  const { logoutAndGoLogin, logoutPending } = useLogout();
  const { me, name, setName, saveName, savePending, goSettings } =
    useProfileScreen();

  const { data: commission } = useQuery({
    queryKey: ["seller", "commission-dashboard"],
    staleTime: sellerOfflineStaleTime,
    queryFn: fetchSellerCommissionDashboard,
  });

  const initials =
    me?.name
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() ?? "?";

  const mtd = commission?.mtd.confirmedRevenue ?? 0;
  const goalTarget = commission?.goal?.targetAmount ?? 0;
  const goalCurrent = commission?.goal?.achievedAmount ?? mtd;
  const rank = commission?.ranking.position;
  const totalSellers = commission?.ranking.totalSellers ?? 0;

  return (
    <SafeScreen variant="tab">
      <MobileHeader title="Perfil" subtitle="Configurações da conta" showBack />
      <KeyboardForm
        contentContainerStyle={{ gap: 20 }}
        bottomPadding={MOBILE_TAB_SCROLL_BOTTOM}
      >
        <ThemedCard>
          <View style={styles.userRow}>
            <View
              style={[
                styles.avatar,
                { backgroundColor: colorWithAlpha(colors.primary, 0.2) },
              ]}
            >
              <ThemedText
                variant="title"
                style={{ color: colors.primary, fontWeight: "700" }}
              >
                {initials}
              </ThemedText>
            </View>
            <View style={{ flex: 1 }}>
              <ThemedText variant="titleSm">{me?.name ?? "—"}</ThemedText>
              <ThemedText variant="bodySm" muted>
                {me?.email}
              </ThemedText>
              {me?.commissionPercent != null ? (
                <ThemedText variant="caption" muted style={{ marginTop: 4 }}>
                  Comissão base {me.commissionPercent}%
                </ThemedText>
              ) : null}
            </View>
            <Pressable
              onPress={goSettings}
              style={[
                styles.settingsIcon,
                { backgroundColor: colors.surfaceMuted },
              ]}
            >
              <Settings color={colors.text} size={20} />
            </Pressable>
          </View>
        </ThemedCard>

        {goalTarget > 0 ? (
          <ProgressStat
            title={
              commission?.goal?.scopeLabel
                ? `${commission.goal.title} · ${commission.goal.scopeLabel}`
                : (commission?.goal?.title ?? "Meta do mês")
            }
            current={goalCurrent}
            target={goalTarget}
            formatValue={(v) => `R$ ${fmtMoney(v)}`}
          />
        ) : null}

        <View style={styles.perfGrid}>
          <View
            style={[
              styles.perfCell,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <ThemedText variant="caption" muted>
              Ranking
            </ThemedText>
            <ThemedText variant="titleSm" style={{ marginTop: 4 }}>
              {rank != null ? `#${rank}` : "—"}
            </ThemedText>
            <ThemedText variant="caption" muted>
              de {totalSellers}
            </ThemedText>
          </View>
          <View
            style={[
              styles.perfCell,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <ThemedText variant="caption" muted>
              Faturamento
            </ThemedText>
            <ThemedText variant="titleSm" style={{ marginTop: 4 }}>
              R$ {fmtMoney(mtd)}
            </ThemedText>
          </View>
          <View
            style={[
              styles.perfCell,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <ThemedText variant="caption" muted>
              Comissão
            </ThemedText>
            <ThemedText variant="titleSm" style={{ marginTop: 4 }}>
              R$ {fmtMoney(commission?.mtd.commissionRecorded ?? 0)}
            </ThemedText>
          </View>
        </View>

        <SyncStatusBanner
          isOnline={isOnline}
          lastSync={lastSync}
          lastSyncedCount={lastSyncedCount}
          pendingItems={0}
        />

        <ThemedCard>
          <ThemedText variant="label" muted style={{ marginBottom: 8 }}>
            Nome de exibição
          </ThemedText>
          <ThemedTextInput value={name} onChangeText={setName} />
          <ThemedButton
            size="lg"
            style={{ marginTop: 12 }}
            loading={savePending}
            loadingLabel="Salvando…"
            onPress={saveName}
          >
            Salvar nome
          </ThemedButton>
        </ThemedCard>

        <ThemedCard padded={false}>
          <MenuRow
            icon={ShoppingBag}
            label="Todas as vendas"
            onPress={() => router.push("/(tabs)/vendas")}
          />
          <MenuRow
            icon={Package}
            label="Catálogo"
            onPress={() => router.push("/(tabs)/products")}
          />
          <MenuRow
            icon={TrendingUp}
            label="Comissão"
            onPress={() => router.push("/(tabs)/commission")}
          />
          <MenuRow
            icon={Bell}
            label="Notificações"
            onPress={() => router.push("/(tabs)/notifications")}
          />
          <MenuRow icon={Shield} label="Privacidade" onPress={goSettings} />
          <MenuRow icon={Smartphone} label="Dispositivo" onPress={goSettings} />
          <MenuRow icon={Database} label="Dados locais" onPress={goSettings} />
          <MenuRow icon={HelpCircle} label="Ajuda" onPress={goSettings} />
          {__DEV__ ? (
            <MenuRow
              icon={Server}
              label="Servidor da API"
              onPress={() => router.push("/devtools")}
            />
          ) : null}
          <View style={{ borderBottomWidth: 0 }}>
            <MenuRow
              icon={Settings}
              label="Configurações"
              onPress={goSettings}
            />
          </View>
        </ThemedCard>

        <ThemedButton
          variant="outline"
          loading={logoutPending}
          loadingLabel="Saindo…"
          onPress={() => void logoutAndGoLogin()}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <LogOut color={colors.danger} size={18} />
            <ThemedText style={{ color: colors.danger, fontWeight: "600" }}>
              Sair da conta
            </ThemedText>
          </View>
        </ThemedButton>

        <DevToolsVersionTap />
      </KeyboardForm>
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  userRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: radiiPx.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  settingsIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  perfGrid: { flexDirection: "row", gap: 10 },
  perfCell: {
    flex: 1,
    borderRadius: radiiPx.lg,
    borderWidth: 1,
    padding: 12,
    alignItems: "center",
  },
});
