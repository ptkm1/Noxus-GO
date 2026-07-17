import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert } from "react-native";
import type { RoutePlanMapRef } from "../../components/RoutePlanMap";
import type { RouteListCustomer } from "../../components/molecules/RouteCustomerListItem";
import { apiFetch } from "../../lib/api";
import type {
  DirectionsRouteResp,
  NearbyCustomersResp,
  SellerVisit,
} from "../../lib/route/types";
import { formatDurationSeconds } from "../../lib/utils/format-duration";
import { openNavigationApp } from "../../lib/utils/open-navigation";

const RADIUS_OPTIONS = [30, 60, 120] as const;
export type RouteRadiusKm = (typeof RADIUS_OPTIONS)[number];

export function useRoutePlanScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const mapRef = useRef<RoutePlanMapRef>(null);

  const [perm, setPerm] = useState<Location.PermissionStatus | null>(null);
  const [myLat, setMyLat] = useState<number | null>(null);
  const [myLng, setMyLng] = useState<number | null>(null);
  const [locErr, setLocErr] = useState<string | null>(null);
  const [, setTick] = useState(0);
  const [optimized, setOptimized] = useState<DirectionsRouteResp | null>(null);
  const [radiusKm, setRadiusKm] = useState<RouteRadiusKm>(30);
  const [myClientsOnly, setMyClientsOnly] = useState(false);
  const [checkInModal, setCheckInModal] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [checkOutModalOpen, setCheckOutModalOpen] = useState(false);
  const [locPending, setLocPending] = useState(false);
  const locPendingRef = useRef(false);

  const refreshLocation = useCallback(async () => {
    if (locPendingRef.current) return;
    locPendingRef.current = true;
    setLocPending(true);
    setLocErr(null);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setPerm(status);
      if (status !== Location.PermissionStatus.GRANTED) {
        setLocErr("Sem permissão de localização.");
        return;
      }
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setMyLat(pos.coords.latitude);
      setMyLng(pos.coords.longitude);
    } catch (e) {
      setLocErr(e instanceof Error ? e.message : "Falha ao obter GPS.");
    } finally {
      locPendingRef.current = false;
      setLocPending(false);
    }
  }, []);

  useEffect(() => {
    void refreshLocation();
  }, [refreshLocation]);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const nearbyQuery = useQuery({
    queryKey: ["seller", "route-nearby", myLat, myLng, radiusKm],
    enabled: myLat != null && myLng != null,
    queryFn: () =>
      apiFetch<NearbyCustomersResp>(
        `/seller/route-plan/nearby?lat=${encodeURIComponent(String(myLat))}&lng=${encodeURIComponent(String(myLng))}&radiusKm=${radiusKm}`,
      ),
  });

  const filteredCustomers = useMemo(() => {
    const list = nearbyQuery.data?.customers ?? [];
    if (!myClientsOnly) return list;
    return list.filter((c) => c.assignedToMe);
  }, [nearbyQuery.data?.customers, myClientsOnly]);

  const activeVisitQuery = useQuery({
    queryKey: ["seller", "visit-active"],
    queryFn: () => apiFetch<SellerVisit | null>("/seller/visits/active"),
    refetchInterval: 20_000,
  });

  const recentVisitsQuery = useQuery({
    queryKey: ["seller", "visits-recent"],
    queryFn: () => apiFetch<SellerVisit[]>("/seller/visits/recent?limit=25"),
  });

  const checkIn = useMutation({
    mutationFn: (payload: {
      customerId: string;
      latitude?: number;
      longitude?: number;
      notes?: string;
    }) =>
      apiFetch<SellerVisit>("/seller/visits/check-in", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      setCheckInModal(null);
      void qc.invalidateQueries({ queryKey: ["seller", "visit-active"] });
      void qc.invalidateQueries({ queryKey: ["seller", "visits-recent"] });
    },
  });

  const checkOut = useMutation({
    mutationFn: (payload: {
      id: string;
      latitude?: number;
      longitude?: number;
      notes?: string;
    }) =>
      apiFetch<SellerVisit>(`/seller/visits/${payload.id}/check-out`, {
        method: "PATCH",
        body: JSON.stringify({
          latitude: payload.latitude,
          longitude: payload.longitude,
          notes: payload.notes,
        }),
      }),
    onSuccess: () => {
      setCheckOutModalOpen(false);
      void qc.invalidateQueries({ queryKey: ["seller", "visit-active"] });
      void qc.invalidateQueries({ queryKey: ["seller", "visits-recent"] });
    },
  });

  const optimizeMutation = useMutation({
    mutationFn: async () => {
      if (myLat == null || myLng == null) throw new Error("Sem localização");
      const withPins = filteredCustomers.filter(
        (c) => Number.isFinite(c.latitude) && Number.isFinite(c.longitude),
      );
      const ids = withPins.slice(0, 14).map((c) => c.id);
      if (ids.length === 0)
        throw new Error("Nenhum cliente com GPS por perto.");
      return apiFetch<DirectionsRouteResp>("/seller/route-plan/directions", {
        method: "POST",
        body: JSON.stringify({
          originLat: myLat,
          originLng: myLng,
          customerIds: ids,
        }),
      });
    },
    onSuccess: (data) => {
      setOptimized(data);
      const fit =
        data.routePolyline.length >= 2
          ? data.routePolyline
          : [
              { latitude: myLat!, longitude: myLng! },
              ...data.orderedCustomers.map((c) => ({
                latitude: c.latitude,
                longitude: c.longitude,
              })),
            ];
      requestAnimationFrame(() => mapRef.current?.fitRoute(fit));
      if (data.source === "air_fallback") {
        Alert.alert(
          "Rota em linha reta",
          data.disclaimer +
            "\n\nPara traçado pelas vias: GOOGLE_MAPS_SERVER_API_KEY em apps/api/.env + Routes API no Google Cloud. Reinicie a API.",
        );
      }
    },
    onError: (e: Error) => Alert.alert("Rota", e.message),
  });

  const polyCoords = useMemo(() => {
    if (!optimized) return [];
    if (optimized.routePolyline.length >= 2) return optimized.routePolyline;
    if (myLat == null || myLng == null) return [];
    return [
      { latitude: myLat, longitude: myLng },
      ...optimized.orderedCustomers.map((c) => ({
        latitude: c.latitude,
        longitude: c.longitude,
      })),
    ];
  }, [optimized, myLat, myLng]);

  const region = useMemo(() => {
    const lat = myLat ?? -14.235;
    const lng = myLng ?? -51.9253;
    return {
      latitude: lat,
      longitude: lng,
      latitudeDelta: 0.12,
      longitudeDelta: 0.12,
    };
  }, [myLat, myLng]);

  const activeVisit = activeVisitQuery.data;
  const hasOpenVisit = !!activeVisit && activeVisit.checkedOutAt == null;

  const displayElapsed =
    hasOpenVisit && activeVisit
      ? formatDurationSeconds(
          Math.max(
            0,
            Math.floor(
              (Date.now() - new Date(activeVisit.checkedInAt).getTime()) / 1000,
            ),
          ),
        )
      : null;

  const routeOrderIndex = useMemo(() => {
    if (!optimized) return new Map<string, number>();
    return new Map(optimized.orderedCustomers.map((c, i) => [c.id, i + 1]));
  }, [optimized]);

  const openCustomer = useCallback(
    (customerId: string) => {
      router.push(`/customer/${customerId}`);
    },
    [router],
  );

  const navigateToCustomer = useCallback(
    async (c: RouteListCustomer, app: "google" | "waze") => {
      try {
        await openNavigationApp(app, c.latitude, c.longitude, c.name);
      } catch (e) {
        Alert.alert(
          "Navegação",
          e instanceof Error ? e.message : "Não foi possível abrir o app.",
        );
      }
    },
    [],
  );

  const submitCheckIn = useCallback(
    (customerId: string, notes?: string) => {
      if (myLat == null || myLng == null) {
        Alert.alert("GPS", "Atualize a sua localização antes do check-in.");
        return;
      }
      checkIn.mutate(
        { customerId, latitude: myLat, longitude: myLng, notes },
        { onError: (err: Error) => Alert.alert("Check-in", err.message) },
      );
    },
    [checkIn, myLat, myLng],
  );

  const requestCheckIn = useCallback(
    (c: RouteListCustomer) => {
      if (hasOpenVisit) {
        Alert.alert(
          "Visita em curso",
          `Termine o check-out em ${activeVisit?.customerName} antes de iniciar outra visita.`,
        );
        return;
      }
      setCheckInModal({ id: c.id, name: c.name });
    },
    [activeVisit?.customerName, hasOpenVisit],
  );

  const submitCheckOut = useCallback(
    (notes?: string) => {
      if (!activeVisit) return;
      const finish = () =>
        checkOut.mutate(
          {
            id: activeVisit.id,
            ...(myLat != null && myLng != null
              ? { latitude: myLat, longitude: myLng }
              : {}),
            notes,
          },
          { onError: (e: Error) => Alert.alert("Check-out", e.message) },
        );

      if (myLat == null || myLng == null) {
        Alert.alert("GPS", "Encerrar sem gravar coordenadas de saída?", [
          { text: "Cancelar", style: "cancel" },
          { text: "Encerrar", onPress: finish },
        ]);
        return;
      }
      finish();
    },
    [activeVisit, checkOut, myLat, myLng],
  );

  const requestCheckOut = useCallback(() => {
    setCheckOutModalOpen(true);
  }, []);

  const openCustomerFromMap = useCallback(
    (c: Pick<RouteListCustomer, "id" | "name" | "latitude" | "longitude">) => {
      const full: RouteListCustomer = filteredCustomers.find(
        (x) => x.id === c.id,
      ) ?? {
        ...c,
        addressNote: null,
        distanceKm: 0,
        assignedToMe: false,
      };
      const isActive = activeVisit?.customerId === full.id && hasOpenVisit;
      Alert.alert(full.name, undefined, [
        { text: "Ver cliente", onPress: () => openCustomer(full.id) },
        {
          text: "Google Maps",
          onPress: () => void navigateToCustomer(full, "google"),
        },
        { text: "Waze", onPress: () => void navigateToCustomer(full, "waze") },
        ...(isActive
          ? [{ text: "Visita em curso", style: "cancel" as const }]
          : hasOpenVisit
            ? [{ text: "Check-in (visita aberta)", style: "cancel" as const }]
            : [{ text: "Check-in", onPress: () => requestCheckIn(full) }]),
        { text: "Fechar", style: "cancel" },
      ]);
    },
    [
      activeVisit?.customerId,
      filteredCustomers,
      hasOpenVisit,
      navigateToCustomer,
      openCustomer,
      requestCheckIn,
    ],
  );

  const goQuickSaleWithCustomer = useCallback(
    (customerId: string) => {
      router.push({ pathname: "/quick-sale", params: { customerId } });
    },
    [router],
  );

  const clearOptimized = useCallback(() => setOptimized(null), []);

  return {
    mapRef,
    perm,
    locErr,
    myLat,
    myLng,
    refreshLocation,
    locPending,
    nearbyQuery,
    filteredCustomers,
    radiusKm,
    setRadiusKm,
    radiusOptions: RADIUS_OPTIONS,
    myClientsOnly,
    setMyClientsOnly,
    activeVisit,
    hasOpenVisit,
    displayElapsed,
    recentVisits: recentVisitsQuery.data ?? [],
    checkIn,
    checkOut,
    optimizeMutation,
    polyCoords,
    region,
    optimized,
    routeOrderIndex,
    openCustomer,
    navigateToCustomer,
    requestCheckIn,
    submitCheckIn,
    requestCheckOut,
    submitCheckOut,
    openCustomerFromMap,
    goQuickSaleWithCustomer,
    clearOptimized,
    formatVisitDuration: formatDurationSeconds,
    checkInModal,
    setCheckInModal,
    checkOutModalOpen,
    setCheckOutModalOpen,
  };
}
