import { CheckCheck } from "lucide-react-native";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useNotificationsScreen } from "../../hooks/screens/useNotificationsScreen";

export default function NotificationsScreen() {
  const { notifications, isLoading, isRefetching, refetch, markRead, markAllRead } =
    useNotificationsScreen();

  return (
    <View style={styles.container}>
      <View style={styles.bar}>
        <Pressable onPress={markAllRead} style={styles.linkBtn}>
          <View style={styles.linkInner}>
            <CheckCheck color="#0284c7" size={18} strokeWidth={2} />
            <Text style={styles.link}>Marcar todas como lidas</Text>
          </View>
        </Pressable>
      </View>
      {isLoading ? (
        <ActivityIndicator style={{ marginTop: 24 }} />
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(n) => n.id}
          refreshing={isRefetching}
          onRefresh={() => void refetch()}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<Text style={styles.empty}>Sem notificações.</Text>}
          renderItem={({ item }) => (
            <Pressable
              style={[styles.card, !item.read && styles.unread]}
              onPress={() => !item.read && markRead(item.id)}
            >
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.body}>{item.body}</Text>
              <Text style={styles.date}>{new Date(item.createdAt).toLocaleString("pt-BR")}</Text>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  bar: { padding: 12, alignItems: "flex-end", backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#e2e8f0" },
  linkBtn: { padding: 8 },
  linkInner: { flexDirection: "row", alignItems: "center", gap: 8 },
  link: { color: "#0284c7", fontWeight: "600" },
  list: { padding: 12, paddingBottom: 32 },
  card: {
    padding: 14,
    backgroundColor: "#fff",
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  unread: { borderColor: "#0284c7", backgroundColor: "#f0f9ff" },
  title: { fontSize: 16, fontWeight: "600", color: "#0f172a" },
  body: { marginTop: 6, fontSize: 14, color: "#475569" },
  date: { marginTop: 8, fontSize: 12, color: "#94a3b8" },
  empty: { textAlign: "center", marginTop: 48, color: "#94a3b8" },
});
