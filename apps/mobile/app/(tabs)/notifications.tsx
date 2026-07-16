import { ThemedCard } from "@/components/atoms/ThemedCard";
import { ThemedText } from "@/components/atoms/ThemedText";
import { MobileHeader, SafeScreen } from "@/components/layout";
import { MOBILE_TAB_SCROLL_BOTTOM } from "@/components/layout/MobileScreen";
import { useNotificationsScreen } from "@/hooks/screens/useNotificationsScreen";
import { useTheme } from "@/lib/theme";
import { colorWithAlpha } from "@/lib/theme/colorAlpha";
import { CheckCheck } from "lucide-react-native";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  View,
} from "react-native";

export default function NotificationsScreen() {
  const { colors } = useTheme();
  const {
    notifications,
    isLoading,
    isRefetching,
    refetch,
    markRead,
    markAllRead,
    markAllPending,
    markReadPending,
    markingId,
  } = useNotificationsScreen();

  const unread = notifications.filter((n) => !n.read).length;
  const busy = markAllPending || markReadPending;

  return (
    <SafeScreen variant="tab">
      <MobileHeader
        title="Notificações"
        subtitle={unread > 0 ? `${unread} não lida(s)` : "Tudo em dia"}
        showBack
        rightAction={
          <Pressable
            onPress={markAllRead}
            style={styles.markAll}
            disabled={busy || unread === 0}
            accessibilityLabel="Marcar todas como lidas"
          >
            {markAllPending ? (
              <ActivityIndicator color={colors.primary} size="small" />
            ) : (
              <CheckCheck
                color={unread === 0 ? colors.iconMuted : colors.primary}
                size={20}
              />
            )}
          </Pressable>
        }
      />
      {isLoading ? (
        <ActivityIndicator style={{ marginTop: 24 }} color={colors.primary} />
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(n) => n.id}
          refreshing={isRefetching}
          onRefresh={() => void refetch()}
          contentContainerStyle={{
            padding: 16,
            paddingBottom: MOBILE_TAB_SCROLL_BOTTOM,
            gap: 10,
          }}
          ListEmptyComponent={
            <ThemedText
              variant="bodySm"
              muted
              style={{ textAlign: "center", marginTop: 48 }}
            >
              Sem notificações.
            </ThemedText>
          }
          renderItem={({ item }) => {
            const itemBusy = markingId === item.id;
            return (
              <Pressable
                onPress={() => !item.read && markRead(item.id)}
                disabled={busy && !itemBusy}
              >
                <ThemedCard
                  style={
                    !item.read
                      ? {
                          borderColor: colors.primary,
                          backgroundColor: colorWithAlpha(colors.primary, 0.06),
                        }
                      : undefined
                  }
                >
                  <View style={styles.itemHeader}>
                    <ThemedText
                      variant="body"
                      style={{ fontWeight: "600", flex: 1 }}
                    >
                      {item.title}
                    </ThemedText>
                    {itemBusy ? (
                      <ActivityIndicator color={colors.primary} size="small" />
                    ) : null}
                  </View>
                  <ThemedText variant="bodySm" muted style={{ marginTop: 6 }}>
                    {item.body}
                  </ThemedText>
                  <ThemedText variant="caption" muted style={{ marginTop: 8 }}>
                    {new Date(item.createdAt).toLocaleString("pt-BR")}
                  </ThemedText>
                </ThemedCard>
              </Pressable>
            );
          }}
        />
      )}
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  markAll: {
    width: 40,
    height: 40,
    borderRadius: 9999,
    alignItems: "center",
    justifyContent: "center",
  },
  itemHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
});
