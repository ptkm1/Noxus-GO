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
import { useTheme } from "../../lib/theme";

/** Altura aproximada da barra de tabs + margem para o FAB ficar acima dela. */
const FAB_ABOVE_TAB_BAR = Platform.select({ ios: 52, android: 56 }) ?? 56;

function QuickSaleFab() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const bottom = Math.max(insets.bottom, 10) + FAB_ABOVE_TAB_BAR + 12;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Venda rápida"
      style={[
        fabStyles.wrap,
        { bottom, backgroundColor: colors.primary, shadowColor: colors.shadow },
      ]}
      onPress={() => router.push("/quick-sale")}
    >
      <ClipboardCheck color={colors.primaryForeground} size={26} strokeWidth={2.5} />
    </Pressable>
  );
}

export default function TabsLayout() {
  const { colors } = useTheme();

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Tabs
        screenOptions={{
          headerShown: true,
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.iconMuted,
          tabBarStyle: {
            backgroundColor: colors.tabBar,
            borderTopColor: colors.tabBarBorder,
            borderTopWidth: 1,
            height: Platform.select({ ios: 88, android: 64 }),
            paddingTop: 6,
          },
          headerStyle: { backgroundColor: colors.headerBackground },
          headerTintColor: colors.primary,
          headerTitleStyle: { color: colors.headerTitle, fontWeight: "600" },
          sceneStyle: { backgroundColor: colors.background },
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
    alignItems: "center",
    justifyContent: "center",
    elevation: 8,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 6,
  },
});
