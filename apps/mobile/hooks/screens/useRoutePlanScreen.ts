import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert } from "react-native";
import type { RoutePlanMapRef } from "../../components/RoutePlanMap";
import { apiFetch } from "../../lib/api";
import type { NearbyCustomersResp, OptimizeRouteResp, SellerVisit } from "../../lib/route/types";
import { formatDurationSeconds } from "../../lib/utils/format-duration";

export function useRoutePlanScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const mapRef = useRef<RoutePlanMapRef>(null);

  const [perm, setPerm] = useState<Location.PermissionStatus | null>(null);
  const [myLat, setMyLat] = useState<number | null>(null);
  const [myLng, setMyLng] = useState<number | null>(null);
  const [locErr, setLocErr] = useState<string | null>(null);
  const [, setTick] = useState(0);
  const [optimized, setOptimized] = useState<OptimizeRouteResp | null>(null);

  const refreshLocation = useCallback(async () => {
    setLocErr(null);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setPerm(status);
      if (status !== Location.PermissionStatus.GRANTED) {
        setLocErr("Sem permissão de localização.");
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setMyLat(pos.coords.latitude);
      setMyLng(pos.coords.longitude);
    } catch (e) {
      setLocErr(e instanceof Error ? e.message : "Falha ao obter GPS.");
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
    queryKey: ["seller", "route-nearby", myLat, myLng],
    enabled: myLat != null && myLng != null,
    queryFn: () =>
      apiFetch<NearbyCustomersResp>(
        `/seller/route-plan/nearby?lat=${encodeURIComponent(String(myLat))}&lng=${encodeURIComponent(String(myLng))}&radiusKm=120`,
      ),
  });

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
    mutationFn: (payload: { customerId: string; latitude?: number; longitude?: number }) =>
      apiFetch<SellerVisit>("/seller/visits/check-in", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["seller", "visit-active"] });
      void qc.invalidateQueries({ queryKey: ["seller", "visits-recent"] });
    },
  });

  const checkOut = useMutation({
    mutationFn: (payload: { id: string; latitude?: number; longitude?: number }) =>
      apiFetch<SellerVisit>(`/seller/visits/${payload.id}/check-out`, {
        method: "PATCH",
        body: JSON.stringify({ latitude: payload.latitude, longitude: payload.longitude }),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["seller", "visit-active"] });
      void qc.invalidateQueries({ queryKey: ["seller", "visits-recent"] });
    },
  });

  const optimizeMutation = useMutation({
    mutationFn: async () => {
      if (myLat == null || myLng == null) throw new Error("Sem localização");
      const customers = nearbyQuery.data?.customers ?? [];
      const withPins = customers.filter((c) => Number.isFinite(c.latitude) && Number.isFinite(c.longitude));
      const ids = withPins.slice(0, 14).map((c) => c.id);
      if (ids.length === 0) throw new Error("Nenhum cliente com GPS por perto.");
      return apiFetch<OptimizeRouteResp>("/seller/route-plan/optimize-order", {
        method: "POST",
        body: JSON.stringify({ originLat: myLat, originLng: myLng, customerIds: ids }),
      });
    },
    onSuccess: (data) => {
      setOptimized(data);
      const coords = [
        { latitude: myLat!, longitude: myLng! },
        ...data.orderedCustomers.map((c) => ({ latitude: c.latitude, longitude: c.longitude })),
      ];
      requestAnimationFrame(() => mapRef.current?.fitRoute(coords));
    },
    onError: (e: Error) => Alert.alert("Rota", e.message),
  });

  const polyCoords = useMemo(() => {
    if (!optimized || myLat == null || myLng == null) return [];
    return [
      { latitude: myLat, longitude: myLng },
      ...optimized.orderedCustomers.map((c) => ({ latitude: c.latitude, longitude: c.longitude })),
    ];
  }, [optimized, myLat, myLng]);

  const region = useMemo(() => {
    const lat = myLat ?? -14.235;
    const lng = myLng ?? -51.9253;
    return { latitude: lat, longitude: lng, latitudeDelta: 0.12, longitudeDelta: 0.12 };
  }, [myLat, myLng]);

  const activeVisit = activeVisitQuery.data;

  const displayElapsed =
    activeVisit && activeVisit.checkedOutAt == null
      ? formatDurationSeconds(
          Math.max(0, Math.floor((Date.now() - new Date(activeVisit.checkedInAt).getTime()) / 1000)),
        )
      : null;

  const openCustomerActions = useCallback(
    (c: { id: string; name: string }) => {
      const hasActive = !!activeVisit && activeVisit.checkedOutAt == null;
      Alert.alert(c.name, undefined, [
        { text: "Ver cliente", onPress: () => router.push(`/customer/${c.id}`) },
        ...(hasActive
          ? [{ text: "Já há visita em curso — faz check-out primeiro", style: "cancel" as const }]
          : [
              {
                text: "Check-in aqui",
                onPress: () => {
                  if (myLat == null || myLng == null) {
                    Alert.alert("GPS", "Atualize a sua localização primeiro.");
                    return;
                  }
                  checkIn.mutate(
                    { customerId: c.id, latitude: myLat, longitude: myLng },
                    { onError: (err: Error) => Alert.alert("Check-in", err.message) },
                  );
                },
              },
            ]),
        { text: "Fechar", style: "cancel" },
      ]);
    },
    [activeVisit, checkIn, myLat, myLng, router],
  );

  const handleCheckOut = useCallback(() => {
    if (!activeVisit) return;
    if (myLat == null || myLng == null) {
      Alert.alert("GPS", "Encerrar sem gravar coordenadas de saída?", [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Encerrar",
          onPress: () =>
            checkOut.mutate(
              { id: activeVisit.id },
              { onError: (e: Error) => Alert.alert("Check-out", e.message) },
            ),
        },
      ]);
      return;
    }
    checkOut.mutate(
      { id: activeVisit.id, latitude: myLat, longitude: myLng },
      { onError: (e: Error) => Alert.alert("Check-out", e.message) },
    );
  }, [activeVisit, checkOut, myLat, myLng]);

  const showMapHint = useCallback(() => {
    Alert.alert("Marcadores", "Toque num ícone no mapa para abrir opções (cliente ou check-in).");
  }, []);

  const clearOptimized = useCallback(() => setOptimized(null), []);

  return {
    mapRef,
    perm,
    locErr,
    myLat,
    myLng,
    refreshLocation,
    nearbyQuery,
    activeVisit,
    displayElapsed,
    recentVisits: recentVisitsQuery.data ?? [],
    checkOut,
    optimizeMutation,
    polyCoords,
    region,
    optimized,
    openCustomerActions,
    handleCheckOut,
    showMapHint,
    clearOptimized,
    formatVisitDuration: formatDurationSeconds,
  };
}
