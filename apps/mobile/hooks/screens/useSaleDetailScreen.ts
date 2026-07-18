import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { apiFetch, sharePdf } from "../../lib/api";

export type SellerOrderDetail = {
  id: string;
  orderNumber?: number | null;
  status: string;
  totalAmount: unknown;
  notes: string | null;
  creditHoldReasons?: unknown;
  createdAt: string;
  customer: { name: string } | null;
  items: {
    id: string;
    productName: string;
    quantity: number;
    unitPrice: unknown;
  }[];
};

export function useSaleDetailScreen() {
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

  return {
    order: query.data,
    isLoading: query.isLoading,
    pdfPending,
    pdfErr,
    shareOrderPdf,
  };
}
