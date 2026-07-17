import AsyncStorage from "@react-native-async-storage/async-storage";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Crypto from "expo-crypto";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { fmtMoney } from "../../components/atoms/formatMoney";
import { apiFetch } from "../../lib/api";
import { enqueueOfflineSale } from "../../lib/offline-outbox";
import { postSellerSale } from "../../lib/offline-sale-sync";
import {
  bumpCartQty,
  cartLineTotal,
  cycleCartLineDiscount,
  LAST_CUSTOMER_STORAGE_KEY,
  PRODUCT_DOUBLE_TAP_MS,
  syncCartLinesWithProducts,
} from "../../lib/sale/cart";
import { getProductStockBlockMessage } from "../../lib/sale/stock";
import type {
  CartLine,
  CreditOverview,
  SaleCustomer,
  SaleProduct,
} from "../../lib/sale/types";
import { findProductByBarcode } from "../../lib/utils/barcode";
import { computeCatalogTileWidths } from "../../lib/utils/catalog-layout";
import { filterCustomersByName } from "../../lib/utils/product-search";
import { useSellerProductCatalog } from "../useSellerProductCatalog";

type SubmitSaleResult =
  | { mode: "online"; status?: string }
  | { mode: "offlineQueued" };

export function useQuickSaleScreen() {
  const router = useRouter();
  const { customerId: customerIdParam } = useLocalSearchParams<{
    customerId?: string;
  }>();
  const qc = useQueryClient();
  const insets = useSafeAreaInsets();
  const layout = computeCatalogTileWidths(useWindowDimensions().width);

  const [customerId, setCustomerId] = useState<string | undefined>();
  const [customerQuery, setCustomerQuery] = useState("");
  const [cart, setCart] = useState<Record<string, CartLine>>({});
  const [barcodeOpen, setBarcodeOpen] = useState(false);
  const [scanMsg, setScanMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [lastCustomerId, setLastCustomerId] = useState<string | null>(null);
  const productTapTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map(),
  );

  const catalog = useSellerProductCatalog({ customerId });
  const { products } = catalog;

  useEffect(() => {
    if (typeof customerIdParam === "string" && customerIdParam.length > 0) {
      setCustomerId(customerIdParam);
    }
  }, [customerIdParam]);

  const { data: customers = [] } = useQuery({
    queryKey: ["seller", "customers"],
    queryFn: () => apiFetch<SaleCustomer[]>("/seller/customers"),
  });

  useEffect(() => {
    let cancelled = false;
    void AsyncStorage.getItem(LAST_CUSTOMER_STORAGE_KEY).then((id) => {
      if (!cancelled && id) setLastCustomerId(id);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return () => {
      productTapTimers.current.forEach((t) => clearTimeout(t));
      productTapTimers.current.clear();
    };
  }, []);

  useEffect(() => {
    setCart((prev) => syncCartLinesWithProducts(prev, products));
  }, [products]);

  useEffect(() => {
    if (!scanMsg) return;
    const t = setTimeout(() => setScanMsg(null), 3800);
    return () => clearTimeout(t);
  }, [scanMsg]);

  useEffect(() => {
    if (!customerId) return;
    void AsyncStorage.setItem(LAST_CUSTOMER_STORAGE_KEY, customerId);
    setLastCustomerId(customerId);
  }, [customerId]);

  const filteredCustomers = useMemo(
    () => filterCustomersByName(customers, customerQuery),
    [customers, customerQuery],
  );

  const lastCustomerEntity = useMemo(() => {
    if (!lastCustomerId) return null;
    return customers.find((c) => c.id === lastCustomerId) ?? null;
  }, [customers, lastCustomerId]);

  const cartQtyByProductId = useMemo(() => {
    const o: Record<string, number> = {};
    for (const line of Object.values(cart)) o[line.productId] = line.qty;
    return o;
  }, [cart]);

  const cartLines = useMemo(() => Object.values(cart), [cart]);
  const cartTotal = useMemo(
    () => cartLines.reduce((s, l) => s + cartLineTotal(l), 0),
    [cartLines],
  );

  const { data: creditInfo, isFetching: creditLoading } = useQuery({
    queryKey: ["seller", "customer-credit", customerId ?? "", cartTotal],
    queryFn: () =>
      apiFetch<CreditOverview>(
        `/seller/customers/${customerId}/credit?previewAmount=${encodeURIComponent(String(cartTotal))}`,
      ),
    enabled: !!customerId,
  });

  const creditBlockedCheckout =
    !!customerId && creditInfo?.effectiveAction === "BLOCK";

  const bumpQty = useCallback((p: SaleProduct, delta: number) => {
    setCart((prev) => {
      const currentQty = prev[p.id]?.qty ?? 0;
      const blockMsg = getProductStockBlockMessage(p, currentQty, delta);
      if (blockMsg) {
        setErr(blockMsg);
        return prev;
      }
      setErr(null);
      return bumpCartQty(prev, p, delta);
    });
  }, []);

  const scheduleProductTap = useCallback(
    (p: SaleProduct) => {
      const id = p.id;
      const timers = productTapTimers.current;
      const pending = timers.get(id);
      if (pending !== undefined) {
        clearTimeout(pending);
        timers.delete(id);
        bumpQty(p, 2);
        return;
      }
      const t = setTimeout(() => {
        timers.delete(id);
        bumpQty(p, 1);
      }, PRODUCT_DOUBLE_TAP_MS);
      timers.set(id, t);
    },
    [bumpQty],
  );

  const cycleDiscount = useCallback((productId: string) => {
    setCart((prev) => cycleCartLineDiscount(prev, productId));
  }, []);

  const onBarcode = useCallback(
    (raw: string) => {
      const p = findProductByBarcode(products, raw);
      if (p && typeof p.effectiveUnitPrice === "number") {
        bumpQty(p, 1);
        setBarcodeOpen(false);
        setScanMsg(null);
      } else {
        setScanMsg("Nenhum produto com este código.");
      }
    },
    [products, bumpQty],
  );

  const cartProductStub = useCallback(
    (line: CartLine): SaleProduct => ({
      id: line.productId,
      name: line.name,
      sku: line.sku,
      effectiveUnitPrice: line.effectiveUnitPrice,
      catalogUnitPrice: line.catalogUnitPrice,
      promotionLabel: line.promotionLabel,
      basePrice: null,
      maxSellerDiscountPercentEffective: line.maxSellerDiscountPercent,
    }),
    [],
  );

  const create = useMutation({
    mutationFn: async (): Promise<SubmitSaleResult> => {
      const lines = Object.values(cart);
      if (!lines.length) throw new Error("Adicione pelo menos um produto");
      const clientMutationId = Crypto.randomUUID();
      const payload = {
        customerId: customerId || undefined,
        status: "CONFIRMED" as const,
        items: lines.map((l) => ({
          productId: l.productId,
          quantity: l.qty,
          ...(l.discountPercent > 0
            ? { discountPercent: l.discountPercent }
            : {}),
        })),
        clientMutationId,
      };

      const result = await postSellerSale(payload);
      if (result.kind === "success")
        return { mode: "online", status: result.status };
      if (result.kind === "dead") throw new Error(result.reason);
      if (result.kind === "auth") throw new Error(result.reason);

      const customerLabel = customerId
        ? customers.find((c) => c.id === customerId)?.name
        : undefined;
      const snapshot = {
        customerLabel,
        lineSummaries: lines.map(
          (l) => `${l.name} × ${l.qty} · R$ ${fmtMoney(cartLineTotal(l))}`,
        ),
        cartTotalApprox: cartTotal,
      };

      const ok = await enqueueOfflineSale({ ...payload, snapshot });
      if (!ok) {
        throw new Error(
          "Armazenamento local indisponível. Offline está disponível na app iOS/Android com SQLite.",
        );
      }
      return { mode: "offlineQueued" };
    },
    onSuccess: (data) => {
      void qc.invalidateQueries({ queryKey: ["seller", "sales"] });
      void qc.invalidateQueries({ queryKey: ["seller", "products"] });
      void qc.invalidateQueries({
        queryKey: ["seller", "commission-dashboard"],
      });
      void qc.invalidateQueries({ queryKey: ["seller", "customer-credit"] });
      if (data.mode === "offlineQueued") {
        Alert.alert(
          "Pedido na fila offline",
          "Assim que houver internet, enviamos automaticamente. Veja em Início → Fila offline.",
          [{ text: "OK", onPress: () => router.back() }],
        );
        setCart({});
        return;
      }
      if (data.status === "PENDING_CREDIT_APPROVAL") {
        Alert.alert(
          "Aguardando aprovação",
          "O escritório precisa liberar este pedido por causa do crédito do cliente.",
          [{ text: "OK", onPress: () => router.back() }],
        );
        return;
      }
      router.back();
    },
  });

  const finalize = useCallback(() => {
    setErr(null);
    create.mutate(undefined, {
      onError: (e) => setErr(e instanceof Error ? e.message : "Erro"),
    });
  }, [create]);

  const openCustomerCredit = useCallback(() => {
    if (customerId) router.push(`/customer/${customerId}`);
  }, [customerId, router]);

  const footerPad = Math.max(insets.bottom, 12) + 72;
  const emptyCatalogMessage =
    products.length === 0
      ? "Nenhum produto liberado pelo admin."
      : "Nenhum resultado para esta pesquisa ou categoria.";

  return {
    insets,
    layout,
    customerId,
    setCustomerId,
    customerQuery,
    setCustomerQuery,
    filteredCustomers,
    lastCustomerEntity,
    catalog,
    cartLines,
    cartTotal,
    cartQtyByProductId,
    creditInfo,
    creditLoading,
    creditBlockedCheckout,
    bumpQty,
    scheduleProductTap,
    cycleDiscount,
    cartProductStub,
    cartLineTotal,
    barcodeOpen,
    setBarcodeOpen,
    scanMsg,
    onBarcode,
    err,
    create,
    finalize,
    openCustomerCredit,
    footerPad,
    emptyCatalogMessage,
  };
}
