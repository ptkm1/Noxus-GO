import { Tabs, useRouter } from "expo-router";
import {
  Bell,
  ClipboardCheck,
  MapPin,
  Package,
  ShoppingBag,
  TrendingUp,
  UserRound,
  Users,
} from "lucide-react-native";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/** Altura aproximada da barra de tabs + margem para o FAB ficar acima dela. */
const FAB_ABOVE_TAB_BAR = Platform.select({ ios: 52, android: 56 }) ?? 56;

function QuickSaleFab() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const bottom = Math.max(insets.bottom, 10) + FAB_ABOVE_TAB_BAR + 12;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Venda rápida"
      style={[fabStyles.wrap, { bottom }]}
      onPress={() => router.push("/quick-sale")}
    >
      <ClipboardCheck color="#fff" size={26} strokeWidth={2.5} />
    </Pressable>
  );
}

export default function TabsLayout() {
  return (
    <View style={{ flex: 1 }}>
      <Tabs
        screenOptions={{
          headerShown: true,
          tabBarActiveTintColor: "#0284c7",
          tabBarInactiveTintColor: "#64748b",
        }}
      >
      <Tabs.Screen
        name="sales"
        options={{
          title: "Vendas",
          tabBarLabel: "Vendas",
          tabBarIcon: ({ color, size }) => <ShoppingBag color={color} size={size} />,
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="commission"
        options={{
          title: "Comissão",
          tabBarLabel: "Comissão",
          tabBarIcon: ({ color, size }) => <TrendingUp color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="customers"
        options={{
          title: "Clientes",
          tabBarLabel: "Clientes",
          tabBarIcon: ({ color, size }) => <Users color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="route-plan"
        options={{
          title: "Rota",
          tabBarLabel: "Rota",
          tabBarIcon: ({ color, size }) => <MapPin color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="products"
        options={{
          title: "Catálogo",
          tabBarLabel: "Catálogo",
          tabBarIcon: ({ color, size }) => <Package color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: "Notificações",
          tabBarLabel: "Avisos",
          tabBarIcon: ({ color, size }) => <Bell color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Perfil",
          tabBarLabel: "Perfil",
          tabBarIcon: ({ color, size }) => <UserRound color={color} size={size} />,
        }}
      />
      </Tabs>
      <QuickSaleFab />
    </View>
  );
}

const fabStyles = StyleSheet.create({
  wrap: {
    position: "absolute",
    right: 18,
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "#0284c7",
    alignItems: "center",
    justifyContent: "center",
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 6,
  },
});
