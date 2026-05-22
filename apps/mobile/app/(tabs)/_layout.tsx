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
import { TabBarIcon } from "@/components/layout";
import { useTheme } from "../../lib/theme";

const TAB_BAR_HEIGHT = Platform.select({ ios: 84, android: 64 }) ?? 64;

function QuickSaleFab() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const bottom = Math.max(insets.bottom, 8) + TAB_BAR_HEIGHT - 8;

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

function tabIcon(Icon: typeof ShoppingBag) {
  return ({
    color,
    focused,
  }: {
    color: string;
    focused: boolean;
    size: number;
  }) => <TabBarIcon Icon={Icon} color={color} focused={focused} />;
}

export default function TabsLayout() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const tabHeight = TAB_BAR_HEIGHT + Math.max(insets.bottom - (Platform.OS === "ios" ? 20 : 0), 0);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.iconMuted,
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: "600",
            marginTop: 2,
          },
          tabBarStyle: {
            backgroundColor: colors.tabBar,
            borderTopColor: colors.tabBarBorder,
            borderTopWidth: 1,
            height: tabHeight,
            paddingTop: 8,
            paddingBottom: Math.max(insets.bottom, Platform.OS === "ios" ? 20 : 8),
          },
          sceneStyle: { backgroundColor: colors.background },
        }}
      >
        <Tabs.Screen
          name="sales"
          options={{
            title: "Vendas",
            tabBarLabel: "Vendas",
            tabBarIcon: tabIcon(ShoppingBag),
          }}
        />
        <Tabs.Screen
          name="commission"
          options={{
            title: "Comissão",
            tabBarLabel: "Comissão",
            tabBarIcon: tabIcon(TrendingUp),
          }}
        />
        <Tabs.Screen
          name="customers"
          options={{
            title: "Clientes",
            tabBarLabel: "Clientes",
            tabBarIcon: tabIcon(Users),
          }}
        />
        <Tabs.Screen
          name="route-plan"
          options={{
            title: "Rota",
            tabBarLabel: "Rota",
            tabBarIcon: tabIcon(MapPin),
          }}
        />
        <Tabs.Screen
          name="products"
          options={{
            title: "Catálogo",
            tabBarLabel: "Catálogo",
            tabBarIcon: tabIcon(Package),
          }}
        />
        <Tabs.Screen
          name="notifications"
          options={{
            title: "Notificações",
            tabBarLabel: "Avisos",
            tabBarIcon: tabIcon(Bell),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: "Perfil",
            tabBarLabel: "Perfil",
            tabBarIcon: tabIcon(UserRound),
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
    zIndex: 50,
  },
});
