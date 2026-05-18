import { useRouter } from "expo-router";
import { useCallback } from "react";
import { Alert } from "react-native";
import { useWindowDimensions } from "react-native";
import { computeCatalogTileWidths } from "../../lib/utils/catalog-layout";
import { useSellerProductCatalog } from "../useSellerProductCatalog";

export function useProductsScreen() {
  const router = useRouter();
  const { width: winW } = useWindowDimensions();
  const layout = computeCatalogTileWidths(winW);

  const catalog = useSellerProductCatalog();

  const promptQuickSale = useCallback(
    (message: string) => {
      Alert.alert("Nova venda", message, [
        { text: "Cancelar", style: "cancel" },
        { text: "Abrir", onPress: () => router.push("/quick-sale") },
      ]);
    },
    [router],
  );

  const onRailProductPress = useCallback(() => {
    promptQuickSale("Abrir a tela de venda para adicionar produtos ao pedido?");
  }, [promptQuickSale]);

  const onFavoriteRailPress = useCallback(() => {
    promptQuickSale("Abrir a tela de venda para usar seus favoritos no pedido?");
  }, [promptQuickSale]);

  const onGridProductPress = useCallback(
    (productName: string) => {
      promptQuickSale(`Para incluir "${productName}" no pedido, abra a venda rápida.`);
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
