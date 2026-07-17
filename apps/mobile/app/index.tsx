import { Redirect } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { useAuth } from "../context/AuthContext";

export default function Index() {
  const { user, loading, sellerAccessBlocked } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (sellerAccessBlocked) return <Redirect href="/seller-access-block" />;

  if (!user) return <Redirect href="/login" />;

  return <Redirect href="/(tabs)" />;
}
