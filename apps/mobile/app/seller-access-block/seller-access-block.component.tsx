import { Redirect, useRouter } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { useAuth } from "../../context/AuthContext";
import { sellerMobileBlockedScreenCopy } from "../../lib/seller-login-messages";
import { useSellerAccessBlockStyles } from "./_seller-access-block.styles";

export default function SellerAccessBlockScreen() {
  const router = useRouter();
  const { sellerAccessBlocked, clearSellerAccessBlocked } = useAuth();
  const styles = useSellerAccessBlockStyles();

  if (!sellerAccessBlocked) {
    return <Redirect href="/login" />;
  }

  const copy = sellerMobileBlockedScreenCopy(sellerAccessBlocked.role);

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{copy.title}</Text>
      <Text style={styles.body}>{copy.body}</Text>
      <Pressable
        style={styles.btn}
        onPress={() => {
          clearSellerAccessBlocked();
          router.replace("/login");
        }}
      >
        <Text style={styles.btnText}>Voltar ao login</Text>
      </Pressable>
    </View>
  );
}
