import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Alert } from "react-native";
import { apiFetch, sharePdf } from "../../lib/api";
import { isRepeatableSale } from "../../lib/repeat-sale";

export type SellerOrderDetail = {
  id: string;
  orderNumber?: number | null;
  status: string;
  totalAmount: unknown;
  notes: string | null;
  creditHoldReasons?: unknown;
  createdAt: string;
  customerId?: string | null;
  paymentConditionId?: string | null;
  customer: { name: string } | null;
  items: {
    id: string;
    productId: string;
    productName: string;
    quantity: number;
    unitPrice: unknown;
  }[];
};

export function useSaleDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [pdfPending, setPdfPending] = useState(false);
  const [pdfErr, setPdfErr] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["seller", "sale", id],
    queryFn: () => apiFetch<SellerOrderDetail>(`/seller/sales/${id}`),
    enabled: !!id,
  });

  const shareOrderPdf = useCallback(async () => {
    if (!id) return;
    setPdfErr(null);
    setPdfPending(true);
    try {
      await sharePdf(`/seller/sales/${id}/pdf`, `pedido-${id.slice(0, 8)}.pdf`);
    } catch (e) {
      setPdfErr(e instanceof Error ? e.message : "Falha ao gerar PDF");
    } finally {
      setPdfPending(false);
    }
  }, [id]);

  const canRepeatSale = isRepeatableSale(query.data);

  const repeatThisSale = useCallback(() => {
    if (!id || !canRepeatSale) {
      Alert.alert("Repetir venda", "Nenhuma venda anterior para repetir");
      return;
    }
    router.push({
      pathname: "/quick-sale",
      params: { repeatSaleId: id },
    });
  }, [canRepeatSale, id, router]);

  return {
    order: query.data,
    isLoading: query.isLoading,
    pdfPending,
    pdfErr,
    shareOrderPdf,
    canRepeatSale,
    repeatThisSale,
  };
}
