import * as Location from "expo-location";
import { Link } from "expo-router";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Clock, Navigation } from "lucide-react-native";
import { RoutePlanMap } from "../../components/RoutePlanMap";
import { useRoutePlanScreen } from "../../hooks/screens/useRoutePlanScreen";

export default function RoutePlanScreen() {
  const {
    mapRef,
    perm,
    locErr,
    myLat,
    myLng,
    refreshLocation,
    nearbyQuery,
    activeVisit,
    displayElapsed,
    recentVisits,
    checkOut,
    optimizeMutation,
    polyCoords,
    region,
    optimized,
    openCustomerActions,
    handleCheckOut,
    showMapHint,
    clearOptimized,
    formatVisitDuration,
  } = useRoutePlanScreen();

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.lead}>
          Clientes com GPS cadastrado pelo escritório aparecem no mapa. A ordem usa o vizinho mais próximo em linha reta
          (não segue estradas nem trânsito).
        </Text>

        {activeVisit && activeVisit.checkedOutAt == null ? (
          <View style={styles.visitBanner}>
            <View style={styles.visitRow}>
              <Clock color="#92400e" size={22} />
              <View style={{ flex: 1 }}>
                <Text style={styles.visitTitle}>Visita em curso · {activeVisit.customerName}</Text>
                <Text style={styles.visitSub}>Tempo no cliente: {displayElapsed ?? "…"}</Text>
              </View>
            </View>
            <Pressable
              style={[styles.checkOutBtn, checkOut.isPending && styles.btnDis]}
              disabled={checkOut.isPending}
              onPress={handleCheckOut}
            >
              <Text style={styles.checkOutTxt}>Check-out</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.toolbar}>
          <Pressable style={styles.toolBtn} onPress={() => void refreshLocation()}>
            <Navigation color="#0369a1" size={20} />
            <Text style={styles.toolBtnTxt}>Atualizar GPS</Text>
          </Pressable>
          <Pressable
            style={[styles.toolBtnPrimary, optimizeMutation.isPending && styles.btnDis]}
            disabled={optimizeMutation.isPending || myLat == null}
            onPress={() => optimizeMutation.mutate()}
          >
            <Text style={styles.toolBtnPrimaryTxt}>
              {optimizeMutation.isPending ? "…" : "Otimizar ordem (próximos)"}
            </Text>
          </Pressable>
        </View>

        {locErr ? <Text style={styles.err}>{locErr}</Text> : null}
        {perm === Location.PermissionStatus.DENIED ? (
          <Text style={styles.warn}>Ative a localização nas definições do telemóvel para usar o mapa.</Text>
        ) : null}

        <RoutePlanMap
          ref={mapRef}
          style={styles.map}
          region={region}
          followUser={myLat != null && myLng != null}
          customers={nearbyQuery.data?.customers ?? []}
          polyCoords={polyCoords}
          onMarkerPress={(c) => openCustomerActions(c)}
        />

        <Pressable style={styles.mapHintBtn} onPress={showMapHint}>
          <Text style={styles.mapHint}>Toque num marcador para ver opções.</Text>
        </Pressable>

        {optimized ? (
          <View style={styles.routeBox}>
            <Text style={styles.routeTitle}>Ordem sugerida (~{optimized.totalKmApprox} km linha reta)</Text>
            {optimized.orderedCustomers.map((c, i) => (
              <Pressable key={c.id} style={styles.routeLine} onPress={() => openCustomerActions(c)}>
                <View style={styles.routeIdxCircle}>
                  <Text style={styles.routeIdxTxt}>{i + 1}</Text>
                </View>
                <Text style={styles.routeName}>{c.name}</Text>
                <Text style={styles.routeKm}>{optimized.legKm[i]?.toFixed(2)} km</Text>
              </Pressable>
            ))}
            <Pressable onPress={clearOptimized}>
              <Text style={styles.clearRoute}>Limpar traçado</Text>
            </Pressable>
          </View>
        ) : null}

        <Text style={styles.section}>Próximos ({nearbyQuery.data?.customers.length ?? "…"})</Text>
        {nearbyQuery.isFetching ? <ActivityIndicator color="#0284c7" /> : null}
        {(nearbyQuery.data?.customers ?? []).length === 0 && nearbyQuery.isFetched ? (
          <Text style={styles.empty}>Sem clientes com coordenadas neste raio. Peça ao escritório para registar GPS.</Text>
        ) : (
          <FlatList
            scrollEnabled={false}
            data={nearbyQuery.data?.customers ?? []}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <Pressable style={styles.rowCard} onPress={() => openCustomerActions(item)}>
                <Text style={styles.rowName}>{item.name}</Text>
                <Text style={styles.rowMeta}>
                  ≈ {item.distanceKm} km · {item.assignedToMe ? "Teu cliente" : "Carteira"}
                </Text>
                {item.addressNote ? <Text style={styles.rowNote}>{item.addressNote}</Text> : null}
              </Pressable>
            )}
          />
        )}

        <Text style={styles.section}>Últimas visitas</Text>
        {recentVisits.slice(0, 8).map((v) => (
          <View key={v.id} style={styles.visitHist}>
            <Text style={styles.visitHistName}>{v.customerName}</Text>
            <Text style={styles.visitHistMeta}>
              {new Date(v.checkedInAt).toLocaleString("pt-BR")}
              {v.durationSeconds != null ? ` · ${formatVisitDuration(v.durationSeconds)}` : ""}
            </Text>
          </View>
        ))}

        <Link href="/quick-sale" asChild>
          <Pressable style={styles.linkQuickSale}>
            <Text style={styles.linkQuickSaleTxt}>Ir para venda rápida →</Text>
          </Pressable>
        </Link>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#f8fafc" },
  scroll: { paddingBottom: 120 },
  lead: { paddingHorizontal: 16, paddingTop: 12, fontSize: 13, color: "#475569", lineHeight: 18 },
  visitBanner: {
    marginHorizontal: 16,
    marginTop: 12,
    padding: 14,
    borderRadius: 14,
    backgroundColor: "#fef3c7",
    borderWidth: 1,
    borderColor: "#fcd34d",
    gap: 12,
  },
  visitRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  visitTitle: { fontSize: 16, fontWeight: "700", color: "#78350f" },
  visitSub: { marginTop: 4, fontSize: 14, fontWeight: "600", color: "#92400e" },
  checkOutBtn: {
    alignSelf: "flex-start",
    backgroundColor: "#ea580c",
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
  },
  checkOutTxt: { color: "#fff", fontWeight: "700", fontSize: 15 },
  toolbar: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    paddingHorizontal: 16,
    marginTop: 14,
  },
  toolBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#bae6fd",
    backgroundColor: "#fff",
  },
  toolBtnTxt: { fontWeight: "600", color: "#0369a1", fontSize: 14 },
  toolBtnPrimary: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "#0284c7",
  },
  toolBtnPrimaryTxt: { fontWeight: "700", color: "#fff", fontSize: 14 },
  btnDis: { opacity: 0.5 },
  err: { marginHorizontal: 16, marginTop: 8, color: "#dc2626", fontSize: 13 },
  warn: { marginHorizontal: 16, marginTop: 8, color: "#b45309", fontSize: 13 },
  map: { marginHorizontal: 16, marginTop: 12, height: 280, borderRadius: 14, overflow: "hidden" },
  mapHint: { textAlign: "center", fontSize: 12, color: "#64748b", paddingHorizontal: 24, marginTop: 6 },
  mapHintBtn: { paddingVertical: 4 },
  routeBox: {
    marginHorizontal: 16,
    marginTop: 14,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    gap: 6,
  },
  routeTitle: { fontWeight: "700", color: "#0f172a", marginBottom: 4 },
  routeLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e2e8f0",
  },
  routeIdxCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#0284c7",
    alignItems: "center",
    justifyContent: "center",
  },
  routeIdxTxt: { color: "#fff", fontWeight: "800", fontSize: 13 },
  routeName: { flex: 1, fontWeight: "600", color: "#1e293b" },
  routeKm: { fontSize: 13, color: "#64748b", fontVariant: ["tabular-nums"] },
  clearRoute: { marginTop: 8, fontSize: 13, fontWeight: "600", color: "#0284c7" },
  section: {
    marginHorizontal: 16,
    marginTop: 18,
    fontSize: 15,
    fontWeight: "700",
    color: "#0f172a",
  },
  empty: { marginHorizontal: 16, marginTop: 8, color: "#94a3b8", fontSize: 13 },
  rowCard: {
    marginHorizontal: 16,
    marginTop: 8,
    padding: 14,
    borderRadius: 12,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  rowName: { fontSize: 16, fontWeight: "700", color: "#0f172a" },
  rowMeta: { marginTop: 4, fontSize: 13, color: "#64748b" },
  rowNote: { marginTop: 6, fontSize: 12, color: "#475569", fontStyle: "italic" },
  visitHist: {
    marginHorizontal: 16,
    marginTop: 8,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e2e8f0",
  },
  visitHistName: { fontWeight: "600", color: "#334155" },
  visitHistMeta: { marginTop: 2, fontSize: 12, color: "#94a3b8" },
  linkQuickSale: { marginHorizontal: 16, marginTop: 24, marginBottom: 8 },
  linkQuickSaleTxt: { fontSize: 15, fontWeight: "700", color: "#0284c7" },
});
