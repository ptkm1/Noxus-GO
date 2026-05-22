import { CheckCheck } from "lucide-react-native";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from "react-native";
import { ThemedText } from "@/components/atoms/ThemedText";
import { ThemedCard } from "@/components/atoms/ThemedCard";
import { MobileHeader } from "@/components/layout";
import { MOBILE_TAB_SCROLL_BOTTOM } from "@/components/layout/MobileScreen";
import { useNotificationsScreen } from "@/hooks/screens/useNotificationsScreen";
import { useTheme } from "@/lib/theme";
import { colorWithAlpha } from "@/lib/theme/colorAlpha";
import { radiiPx } from "@pedidos/design-tokens";

export default function NotificationsScreen() {
  const { colors } = useTheme();
  const { notifications, isLoading, isRefetching, refetch, markRead, markAllRead } =
    useNotificationsScreen();

  const unread = notifications.filter((n) => !n.read).length;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <MobileHeader
        title="Notificações"
        subtitle={unread > 0 ? `${unread} não lida(s)` : "Tudo em dia"}
        rightAction={
          <Pressable onPress={markAllRead} style={styles.markAll}>
            <CheckCheck color={colors.primary} size={20} />
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
            <ThemedText variant="bodySm" muted style={{ textAlign: "center", marginTop: 48 }}>
              Sem notificações.
            </ThemedText>
          }
          renderItem={({ item }) => (
            <Pressable onPress={() => !item.read && markRead(item.id)}>
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
                <ThemedText variant="body" style={{ fontWeight: "600" }}>
                  {item.title}
                </ThemedText>
                <ThemedText variant="bodySm" muted style={{ marginTop: 6 }}>
                  {item.body}
                </ThemedText>
                <ThemedText variant="caption" muted style={{ marginTop: 8 }}>
                  {new Date(item.createdAt).toLocaleString("pt-BR")}
                </ThemedText>
              </ThemedCard>
            </Pressable>
          )}
        />
      )}
    </View>
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
});
