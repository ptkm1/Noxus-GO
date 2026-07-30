import { SafeScreen } from "@/components/layout";
import { Redirect } from "expo-router";
import { ActivityIndicator } from "react-native";
import { useAuth } from "../context/AuthContext";

export default function Index() {
  const { user, loading, sellerAccessBlocked, orgAccessBlocked } = useAuth();

  if (loading) {
    return (
      <SafeScreen style={{ justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" />
      </SafeScreen>
    );
  }

  if (sellerAccessBlocked) return <Redirect href="/seller-access-block" />;
  if (orgAccessBlocked) return <Redirect href="/org-access-block" />;

  if (!user) return <Redirect href="/login" />;

  return <Redirect href="/(tabs)" />;
}
