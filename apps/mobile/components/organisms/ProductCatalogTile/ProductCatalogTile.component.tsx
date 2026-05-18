import { Heart, Package } from "lucide-react-native";
import type { ReactNode } from "react";
import { Image, Pressable, Text, View } from "react-native";
import { fmtMoney } from "../../atoms/formatMoney";
import type { CatalogTileProduct } from "./catalog-tile.types";
import { useProductCatalogTileStyles } from "./ProductCatalogTile.styles";

export function ProductCatalogTile(props: {
  variant: "rail" | "grid";
  tileWidth: number;
  product: CatalogTileProduct;
  favorite: boolean;
  onToggleFavorite: () => void;
  onAddPress: () => void;
  qtyInCart?: number;
  badgeBackgroundColor?: string;
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
  } = props;

  const imgHeight = variant === "rail" ? 104 : 128;
  const styles = useProductCatalogTileStyles({ tileWidth, imgHeight, badgeBackgroundColor });
  const uri = product.imageUrl?.trim();

  let priceNode: ReactNode;
  if (typeof product.effectiveUnitPrice === "number") {
    priceNode = <Text style={styles.price}>R$ {fmtMoney(product.effectiveUnitPrice)}</Text>;
  } else {
    priceNode = <Text style={styles.noPrice}>Sem preço</Text>;
  }

  return (
    <View style={styles.card}>
      <Pressable
        hitSlop={6}
        style={styles.favBtn}
        onPress={onToggleFavorite}
        accessibilityLabel={favorite ? "Remover dos favoritos" : "Adicionar aos favoritos"}
      >
        <Heart
          size={22}
          color={favorite ? "#ef4444" : "#94a3b8"}
          fill={favorite ? "#fecaca" : "transparent"}
          strokeWidth={2.2}
        />
      </Pressable>
      <Pressable style={styles.mainTap} onPress={onAddPress}>
        <View style={styles.imgBox}>
          {uri ? (
            <Image source={{ uri }} style={styles.img} resizeMode="cover" accessibilityIgnoresInvertColors />
          ) : (
            <View style={styles.imgPh}>
              <Package size={36} color="#94a3b8" strokeWidth={2} />
            </View>
          )}
          {qtyInCart != null && qtyInCart > 0 ? (
            <View style={styles.badge}>
              <Text style={styles.badgeTxt}>{qtyInCart}</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.name} numberOfLines={2}>
          {product.name}
        </Text>
        {product.category ? (
          <Text style={styles.catLine} numberOfLines={1}>
            {product.category.name}
          </Text>
        ) : null}
        {priceNode}
      </Pressable>
    </View>
  );
}
