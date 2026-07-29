import { useRouter } from "expo-router";
import { useCallback } from "react";
import { useWindowDimensions } from "react-native";
import { useConfirm } from "../../context/ConfirmContext";
import { computeCatalogTileWidths } from "../../lib/utils/catalog-layout";
import { useSellerProductCatalog } from "../useSellerProductCatalog";

export function useProductsScreen() {
  const router = useRouter();
  const { confirm } = useConfirm();
  const { width: winW } = useWindowDimensions();
  const layout = computeCatalogTileWidths(winW);

  const catalog = useSellerProductCatalog();

  const promptQuickSale = useCallback(
    async (message: string) => {
      const ok = await confirm({
        title: "Nova venda",
        description: message,
        confirmLabel: "Abrir",
        cancelLabel: "Cancelar",
        tone: "default",
      });
      if (ok) router.push("/quick-sale");
    },
    [confirm, router],
  );

  const onRailProductPress = useCallback(() => {
    void promptQuickSale(
      "Abrir a tela de venda para adicionar produtos ao pedido?",
    );
  }, [promptQuickSale]);

  const onFavoriteRailPress = useCallback(() => {
    void promptQuickSale(
      "Abrir a tela de venda para usar seus favoritos no pedido?",
    );
  }, [promptQuickSale]);

  const onGridProductPress = useCallback(
    (productName: string) => {
      void promptQuickSale(
        `Para incluir "${productName}" no pedido, abra a venda rápida.`,
      );
    },
    [promptQuickSale],
  );

  const emptyMessage =
    catalog.products.length === 0
      ? "Nenhum produto liberado pela empresa."
      : "Nenhum resultado para esta busca ou categoria.";

  return {
    layout,
    catalog,
    onRailProductPress,
    onFavoriteRailPress,
    onGridProductPress,
    emptyMessage,
  };
}
