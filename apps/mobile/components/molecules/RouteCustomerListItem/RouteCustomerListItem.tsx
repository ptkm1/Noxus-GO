import { LogIn, MapPin, Navigation } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTheme } from "../../../lib/theme";
import type { NearbyCustomersResp } from "../../../lib/route/types";

export type RouteListCustomer = NearbyCustomersResp["customers"][number];

type Props = {
  customer: RouteListCustomer;
  routeIndex?: number;
  isActiveVisit: boolean;
  canCheckIn: boolean;
  checkInPending: boolean;
  onPressCustomer: () => void;
  onCheckIn: () => void;
  onNavigateGoogle: () => void;
  onNavigateWaze: () => void;
};

export function RouteCustomerListItem({
  customer,
  routeIndex,
  isActiveVisit,
  canCheckIn,
  checkInPending,
  onPressCustomer,
  onCheckIn,
  onNavigateGoogle,
  onNavigateWaze,
}: Props) {
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: isActiveVisit ? colors.warningSurface : colors.card,
          borderColor: isActiveVisit ? colors.warning : colors.border,
        },
      ]}
    >
      <Pressable onPress={onPressCustomer} style={styles.main}>
        {routeIndex != null ? (
          <View style={[styles.idx, { backgroundColor: colors.primary }]}>
            <Text style={[styles.idxTxt, { color: colors.primaryForeground }]}>{routeIndex}</Text>
          </View>
        ) : null}
        <View style={styles.body}>
          <Text style={[styles.name, { color: colors.text }]}>{customer.name}</Text>
          <Text style={[styles.meta, { color: colors.textSecondary }]}>
            ≈ {customer.distanceKm} km · {customer.assignedToMe ? "Teu cliente" : "Carteira"}
          </Text>
          {customer.addressNote ? (
            <Text style={[styles.note, { color: colors.textMuted }]} numberOfLines={2}>
              {customer.addressNote}
            </Text>
          ) : null}
          {isActiveVisit ? (
            <Text style={[styles.activeTag, { color: colors.warning }]}>Visita em curso</Text>
          ) : null}
        </View>
      </Pressable>
      <View style={styles.actions}>
        <Pressable
          style={[styles.actionBtn, { borderColor: colors.border, backgroundColor: colors.surfaceMuted }]}
          onPress={onNavigateGoogle}
          accessibilityLabel="Abrir no Google Maps"
        >
          <MapPin color={colors.link} size={18} />
          <Text style={[styles.actionTxt, { color: colors.link }]}>Maps</Text>
        </Pressable>
        <Pressable
          style={[styles.actionBtn, { borderColor: colors.border, backgroundColor: colors.surfaceMuted }]}
          onPress={onNavigateWaze}
          accessibilityLabel="Abrir no Waze"
        >
          <Navigation color={colors.link} size={18} />
          <Text style={[styles.actionTxt, { color: colors.link }]}>Waze</Text>
        </Pressable>
        {canCheckIn ? (
          <Pressable
            style={[
              styles.actionBtn,
              styles.checkInBtn,
              { backgroundColor: colors.primary },
              checkInPending && styles.btnDis,
            ]}
            disabled={checkInPending}
            onPress={onCheckIn}
          >
            <LogIn color={colors.primaryForeground} size={18} />
            <Text style={[styles.actionTxt, { color: colors.primaryForeground }]}>Check-in</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
  },
  main: { flexDirection: "row", padding: 14, gap: 10, alignItems: "flex-start" },
  idx: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  idxTxt: { fontWeight: "800", fontSize: 13 },
  body: { flex: 1, gap: 2 },
  name: { fontSize: 16, fontWeight: "700" },
  meta: { fontSize: 13, marginTop: 2 },
  note: { fontSize: 12, fontStyle: "italic", marginTop: 4 },
  activeTag: { marginTop: 6, fontSize: 12, fontWeight: "700" },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  checkInBtn: { borderWidth: 0, marginLeft: "auto" },
  actionTxt: { fontSize: 13, fontWeight: "600" },
  btnDis: { opacity: 0.5 },
});
