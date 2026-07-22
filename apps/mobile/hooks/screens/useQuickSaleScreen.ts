import AsyncStorage from "@react-native-async-storage/async-storage";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Crypto from "expo-crypto";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { fmtMoney } from "../../components/atoms/formatMoney";
import { useAppToast } from "../../context/ToastContext";
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
  PaymentCondition,
  QuickSaleTab,
  SaleCustomer,
  SaleProduct,
} from "../../lib/sale/types";
import {
  fetchSellerCustomers,
  sellerOfflineStaleTime,
} from "../../lib/seller-offline-queries";
import { findProductByBarcode } from "../../lib/utils/barcode";
import { computeCatalogTileWidths } from "../../lib/utils/catalog-layout";
import { useNetInfoOnline } from "../useNetInfoOnline";
import { useOrderSyncMode } from "../useOrderSyncMode";
import { useSellerProductCatalog } from "../useSellerProductCatalog";

type SubmitSaleResult =
  | { mode: "online"; status?: string }
  | { mode: "offlineQueued" };

function digitsOnly(v: string): string {
  return v.replace(/\D/g, "");
}

function formatDoc(c: SaleCustomer): string {
  if (c.cnpj) {
    const d = digitsOnly(c.cnpj);
    if (d.length === 14) {
      return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
    }
    return c.cnpj;
  }
  if (c.cpf) {
    const d = digitsOnly(c.cpf);
    if (d.length === 11) {
      return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
    }
    return c.cpf;
  }
  return "—";
}

export function useQuickSaleScreen() {
  const router = useRouter();
  const { showToast } = useAppToast();
  const { customerId: customerIdParam } = useLocalSearchParams<{
    customerId?: string;
  }>();
  const qc = useQueryClient();
  const insets = useSafeAreaInsets();
  const layout = computeCatalogTileWidths(useWindowDimensions().width);

  const [tab, setTab] = useState<QuickSaleTab>("clientes");
  const [customerId, setCustomerIdState] = useState<string | undefined>();
  const [paymentConditionId, setPaymentConditionId] = useState<
    string | undefined
  >();
  const [cart, setCart] = useState<Record<string, CartLine>>({});
  const [barcodeOpen, setBarcodeOpen] = useState(false);
  const [scanMsg, setScanMsg] = useState<string | null>(null);
  const [scanMsgOk, setScanMsgOk] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [lastCustomerId, setLastCustomerId] = useState<string | null>(null);
  const [customerSearch, setCustomerSearch] = useState({
    code: "",
    document: "",
    legalName: "",
    tradeName: "",
    city: "",
  });
  const [paymentPickerOpen, setPaymentPickerOpen] = useState(false);
  const productTapTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map(),
  );

  const isOnline = useNetInfoOnline();
  const { orderSyncMode } = useOrderSyncMode();
  const catalog = useSellerProductCatalog({ customerId });
  const { products } = catalog;

  const setCustomerId = useCallback((id: string | undefined) => {
    setCustomerIdState(id);
    setPaymentConditionId(undefined);
    if (!id) setTab("clientes");
  }, []);

  useEffect(() => {
    if (typeof customerIdParam === "string" && customerIdParam.length > 0) {
      setCustomerIdState(customerIdParam);
    }
  }, [customerIdParam]);

  const { data: customers = [] } = useQuery({
    queryKey: ["seller", "customers"],
    staleTime: sellerOfflineStaleTime,
    queryFn: () => fetchSellerCustomers() as Promise<SaleCustomer[]>,
  });

  const { data: paymentConditions = [] } = useQuery({
    queryKey: ["seller", "payment-conditions"],
    staleTime: sellerOfflineStaleTime,
    queryFn: () => apiFetch<PaymentCondition[]>("/seller/payment-conditions"),
  });

  useEffect(() => {
    if (paymentConditionId) return;
    const cash = paymentConditions.find(
      (p) => p.days === 0 || p.code === "1" || /vista/i.test(p.name),
    );
    if (cash) setPaymentConditionId(cash.id);
    else if (paymentConditions[0])
      setPaymentConditionId(paymentConditions[0].id);
  }, [paymentConditions, paymentConditionId, customerId]);

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
    const t = setTimeout(() => {
      setScanMsg(null);
      setScanMsgOk(false);
    }, 3800);
    return () => clearTimeout(t);
  }, [scanMsg]);

  useEffect(() => {
    if (!customerId) return;
    void AsyncStorage.setItem(LAST_CUSTOMER_STORAGE_KEY, customerId);
    setLastCustomerId(customerId);
  }, [customerId]);

  const selectedCustomer = useMemo(() => {
    if (!customerId) return null;
    return customers.find((c) => c.id === customerId) ?? null;
  }, [customers, customerId]);

  const selectedPaymentCondition = useMemo(() => {
    if (!paymentConditionId) return null;
    return paymentConditions.find((p) => p.id === paymentConditionId) ?? null;
  }, [paymentConditions, paymentConditionId]);

  const lastCustomerEntity = useMemo(() => {
    if (!lastCustomerId) return null;
    const c = customers.find((x) => x.id === lastCustomerId) ?? null;
    if (c?.approvalStatus && c.approvalStatus !== "APPROVED") return null;
    return c;
  }, [customers, lastCustomerId]);

  const filteredCustomers = useMemo(() => {
    const code = customerSearch.code.trim().toLowerCase();
    const doc = digitsOnly(customerSearch.document);
    const legal = customerSearch.legalName.trim().toLowerCase();
    const trade = customerSearch.tradeName.trim().toLowerCase();
    const city = customerSearch.city.trim().toLowerCase();

    return customers.filter((c) => {
      if (c.approvalStatus && c.approvalStatus !== "APPROVED") return false;
      if (
        code &&
        !c.id.toLowerCase().includes(code) &&
        !(c.name ?? "").toLowerCase().includes(code)
      ) {
        return false;
      }
      if (doc) {
        const hay = digitsOnly(`${c.cnpj ?? ""}${c.cpf ?? ""}`);
        if (!hay.includes(doc)) return false;
      }
      if (legal) {
        const hay = `${c.legalName ?? ""} ${c.name ?? ""}`.toLowerCase();
        if (!hay.includes(legal)) return false;
      }
      if (trade) {
        const hay = `${c.tradeName ?? ""} ${c.name ?? ""}`.toLowerCase();
        if (!hay.includes(trade)) return false;
      }
      if (city) {
        const hay = `${c.city ?? ""} ${c.state ?? ""}`.toLowerCase();
        if (!hay.includes(city)) return false;
      }
      return true;
    });
  }, [customers, customerSearch]);

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

  const canAccessProducts = !!customerId;
  const canFinalize =
    !!customerId &&
    !!paymentConditionId &&
    cartLines.length > 0 &&
    !creditBlockedCheckout;

  const bumpQty = useCallback(
    (p: SaleProduct, delta: number) => {
      if (!customerId) {
        setErr("Selecione um cliente antes de adicionar produtos.");
        setTab("clientes");
        return;
      }
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
    },
    [customerId],
  );

  const scheduleProductTap = useCallback(
    (p: SaleProduct) => {
      if (!customerId) {
        setErr("Selecione um cliente antes de adicionar produtos.");
        setTab("clientes");
        return;
      }
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
    [bumpQty, customerId],
  );

  const cycleDiscount = useCallback((productId: string) => {
    setCart((prev) => cycleCartLineDiscount(prev, productId));
  }, []);

  const onBarcode = useCallback(
    (raw: string) => {
      if (!customerId) {
        setBarcodeOpen(false);
        setErr("Selecione um cliente antes de adicionar produtos.");
        setTab("clientes");
        return;
      }
      const codeLabel = raw.trim() || "(vazio)";
      const p = findProductByBarcode(products, raw);
      setBarcodeOpen(false);
      if (p && typeof p.effectiveUnitPrice === "number") {
        bumpQty(p, 1);
        setScanMsgOk(true);
        setScanMsg(`Produto adicionado: ${p.name}`);
      } else {
        setScanMsgOk(false);
        setScanMsg(`Não existe produto com o código ${codeLabel} no sistema.`);
      }
    },
    [products, bumpQty, customerId],
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
      if (!customerId) throw new Error("Selecione o cliente do pedido.");
      if (!paymentConditionId) {
        throw new Error("Selecione a condição de pagamento.");
      }
      if (!lines.length) throw new Error("Adicione pelo menos um produto");
      const clientMutationId = Crypto.randomUUID();
      const payload = {
        customerId,
        paymentConditionId,
        operation: "SALE" as const,
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

      const buildSnapshot = () => {
        const customerLabel =
          selectedCustomer?.tradeName ||
          selectedCustomer?.name ||
          customers.find((c) => c.id === customerId)?.name;
        return {
          customerLabel,
          paymentConditionLabel: selectedPaymentCondition
            ? `${selectedPaymentCondition.code} - ${selectedPaymentCondition.name}`
            : undefined,
          lineSummaries: lines.map(
            (l) => `${l.name} × ${l.qty} · R$ ${fmtMoney(cartLineTotal(l))}`,
          ),
          cartTotalApprox: cartTotal,
        };
      };

      const enqueueLocal = async () => {
        const ok = await enqueueOfflineSale({
          ...payload,
          snapshot: buildSnapshot(),
        });
        if (!ok) {
          throw new Error(
            "Armazenamento local indisponível. Offline está disponível na app iOS/Android com SQLite.",
          );
        }
        return { mode: "offlineQueued" as const };
      };

      if (orderSyncMode === "MANUAL") {
        return enqueueLocal();
      }

      const result = await postSellerSale(payload);
      if (result.kind === "success")
        return { mode: "online", status: result.status };
      if (result.kind === "dead") throw new Error(result.reason);
      if (result.kind === "auth") throw new Error(result.reason);

      return enqueueLocal();
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
          orderSyncMode === "MANUAL"
            ? "Pedido na fila"
            : "Pedido na fila offline",
          orderSyncMode === "MANUAL"
            ? "Envio manual ativo: toque em Sincronizar na fila de pedidos para enviar ao servidor."
            : "Assim que houver internet, enviamos automaticamente. Veja em Início → Fila offline.",
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
      showToast({
        message: "Venda realizada com sucesso!",
        tone: "success",
      });
      router.back();
    },
  });

  const finalize = useCallback(() => {
    setErr(null);
    if (!customerId) {
      setErr("Selecione o cliente do pedido.");
      setTab("clientes");
      return;
    }
    if (!paymentConditionId) {
      setErr("Selecione a condição de pagamento.");
      setTab("clientes");
      return;
    }
    if (cartLines.length === 0) {
      setErr("Adicione produtos ao pedido.");
      setTab("produtos");
      return;
    }
    create.mutate(undefined, {
      onError: (e) => setErr(e instanceof Error ? e.message : "Erro"),
    });
  }, [create, customerId, paymentConditionId, cartLines.length]);

  const openCustomerCredit = useCallback(() => {
    if (customerId) router.push(`/customer/${customerId}`);
  }, [customerId, router]);

  const clearScanMsg = useCallback(() => {
    setScanMsg(null);
    setScanMsgOk(false);
  }, []);

  const selectCustomer = useCallback(
    (id: string) => {
      setCustomerId(id);
      setErr(null);
    },
    [setCustomerId],
  );

  const clearCustomer = useCallback(() => {
    setCustomerId(undefined);
    setCart({});
    setCustomerSearch({
      code: "",
      document: "",
      legalName: "",
      tradeName: "",
      city: "",
    });
  }, [setCustomerId]);

  const goTab = useCallback(
    (next: QuickSaleTab) => {
      if (next !== "clientes" && !customerId) {
        setErr("Selecione um cliente para continuar.");
        setTab("clientes");
        return;
      }
      if (next === "finalizar" && !paymentConditionId) {
        setErr("Selecione a condição de pagamento.");
        setTab("clientes");
        return;
      }
      setErr(null);
      setTab(next);
    },
    [customerId, paymentConditionId],
  );

  const emptyCatalogMessage =
    products.length === 0
      ? !isOnline
        ? "Sem catálogo em cache. Liga a internet uma vez para sincronizar."
        : "Nenhum produto liberado pelo admin."
      : "Nenhum resultado para esta pesquisa ou categoria.";

  return {
    insets,
    layout,
    tab,
    goTab,
    customerId,
    setCustomerId,
    selectedCustomer,
    formatDoc,
    customers,
    filteredCustomers,
    customerSearch,
    setCustomerSearch,
    selectCustomer,
    clearCustomer,
    lastCustomerEntity,
    paymentConditions,
    paymentConditionId,
    setPaymentConditionId,
    selectedPaymentCondition,
    paymentPickerOpen,
    setPaymentPickerOpen,
    catalog,
    cartLines,
    cartTotal,
    cartQtyByProductId,
    creditInfo,
    creditLoading,
    creditBlockedCheckout,
    canAccessProducts,
    canFinalize,
    bumpQty,
    scheduleProductTap,
    cycleDiscount,
    cartProductStub,
    cartLineTotal,
    barcodeOpen,
    setBarcodeOpen,
    scanMsg,
    scanMsgOk,
    clearScanMsg,
    onBarcode,
    err,
    create,
    finalize,
    openCustomerCredit,
    emptyCatalogMessage,
  };
}
