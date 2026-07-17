import { useTheme } from "@/lib/theme";
import {
  formatProductPriceWithUnit,
  formatProductStockLabel,
  formatProductUnitLabel,
  isProductSaleBlockedByStock,
} from "@pedidos/shared";
import { Heart, Package } from "lucide-react-native";
import type { ReactNode } from "react";
import { Image, Pressable, Text, View } from "react-native";
import { fmtMoney } from "../../atoms/formatMoney";
import type { CatalogTileProduct } from "./catalog-tile.types";
import { useProductCatalogTileStyles } from "./ProductCatalogTile.styles";

export function ProductCatalogTile(props: {
  variant: "rail" | "grid" | "list";
  tileWidth: number;
  product: CatalogTileProduct;
  favorite: boolean;
  onToggleFavorite: () => void;
  onAddPress: () => void;
  qtyInCart?: number;
  badgeBackgroundColor?: string;
  disabled?: boolean;
}) {
  const {
    variant,
    tileWidth,
    product,
    favorite,
    onToggleFavorite,
    onAddPress,
    qtyInCart,
    badgeBackgroundColor,
    disabled: disabledProp,
  } = props;

  const stockQty = product.stockQty ?? 0;
  const blocked = isProductSaleBlockedByStock(
    stockQty,
    product.blockSaleWhenOutOfStock ?? false,
  );
  const disabled = disabledProp ?? blocked;

  const imgHeight = variant === "rail" ? 104 : variant === "list" ? 88 : 128;
  const styles = useProductCatalogTileStyles({
    variant,
    tileWidth,
    imgHeight,
    badgeBackgroundColor,
    disabled,
  });
  const { colors } = useTheme();
  const uri = product.imageUrl?.trim();
  const unitLabel = formatProductUnitLabel(product.attributes);
  const stockLabel = formatProductStockLabel(stockQty);

  let priceNode: ReactNode;
  if (typeof product.effectiveUnitPrice === "number") {
    const priceText =
      unitLabel != null
        ? formatProductPriceWithUnit(
            product.effectiveUnitPrice,
            product.attributes,
          )
        : `R$ ${fmtMoney(product.effectiveUnitPrice)}`;
    priceNode = <Text style={styles.price}>{priceText}</Text>;
  } else {
    priceNode = <Text style={styles.noPrice}>Sem preço</Text>;
  }

  return (
    <View style={styles.card}>
      <Pressable
        hitSlop={6}
        style={styles.favBtn}
        onPress={onToggleFavorite}
        accessibilityLabel={
          favorite ? "Remover dos favoritos" : "Adicionar aos favoritos"
        }
      >
        <Heart
          size={16}
          color={favorite ? "#ef4444" : "#94a3b8"}
          fill={favorite ? "#fecaca" : "transparent"}
          strokeWidth={2}
        />
      </Pressable>
      <Pressable
        style={styles.mainTap}
        onPress={onAddPress}
        disabled={disabled}
      >
        <View style={styles.imgBox}>
          {uri ? (
            <Image
              source={{ uri }}
              style={styles.img}
              resizeMode="cover"
              accessibilityIgnoresInvertColors
            />
          ) : (
            <View style={styles.imgPh}>
              <Package
                size={variant === "list" ? 28 : 36}
                color="#94a3b8"
                strokeWidth={2}
              />
            </View>
          )}
          {qtyInCart != null && qtyInCart > 0 ? (
            <View style={styles.badge}>
              <Text style={styles.badgeTxt}>{qtyInCart}</Text>
            </View>
          ) : null}
        </View>
        <View style={styles.body}>
          <Text style={styles.name} numberOfLines={variant === "list" ? 2 : 2}>
            {product.name}
          </Text>
          {product.category ? (
            <Text style={styles.catLine} numberOfLines={1}>
              {product.category.name}
            </Text>
          ) : null}
          {unitLabel && variant !== "list" ? (
            <Text style={styles.metaLine} numberOfLines={1}>
              {unitLabel}
            </Text>
          ) : null}
          <Text
            style={[
              styles.stockLine,
              { color: blocked ? colors.danger : colors.textMuted },
            ]}
            numberOfLines={1}
          >
            {stockLabel}
          </Text>
        </View>
        {priceNode}
      </Pressable>
    </View>
  );
}
