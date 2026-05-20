import { Search } from "lucide-react-native";
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from "react-native";
import { ThemedTextInput } from "../../components/atoms/ThemedTextInput";
import {
  CategoryFilterBar,
  HorizontalProductRail,
  ProductCatalogTile,
} from "../../components/ProductCatalogViews";
import { useThemedStyles } from "../../hooks/useThemedStyles";
import { useProductsScreen } from "../../hooks/screens/useProductsScreen";
import { useTheme } from "../../lib/theme";
import type { AppColors } from "../../lib/theme/types";

export default function ProductsScreen() {
  const styles = useThemedStyles(createProductsStyles);
  const { colors } = useTheme();
  const {
    layout,
    catalog,
    onRailProductPress,
    onFavoriteRailPress,
    onGridProductPress,
    emptyMessage,
  } = useProductsScreen();

  const header = (
    <View style={styles.header}>
      <Text style={styles.lead}>
        Veja fotos e preços de referência. Para montar o pedido com cliente e carrinho, use{" "}
        <Text style={styles.leadBold}>Venda rápida</Text>.
      </Text>
      <View style={styles.searchRow}>
        <Search size={18} color={colors.iconMuted} style={styles.searchIcon} />
        <ThemedTextInput
          style={styles.searchInput}
          placeholder="Buscar nome, SKU ou categoria…"
          value={catalog.productQuery}
          onChangeText={catalog.setProductQuery}
          autoCorrect={false}
        />
      </View>

      <CategoryFilterBar
        categories={catalog.catalogCategories}
        selectedCategoryId={catalog.categoryFilterId}
        onSelectCategory={catalog.setCategoryFilterId}
      />

      <HorizontalProductRail
        title="Mais vendidos"
        products={catalog.topSellingProducts}
        tileWidth={layout.railTileW}
        favoriteIds={catalog.favoriteIds}
        onToggleFavorite={catalog.toggleFavorite}
        onProductPress={onRailProductPress}
      />

      <HorizontalProductRail
        title="Favoritos"
        products={catalog.favoriteProductsList}
        tileWidth={layout.railTileW}
        favoriteIds={catalog.favoriteIds}
        onToggleFavorite={catalog.toggleFavorite}
        onProductPress={onFavoriteRailPress}
      />

      <Text style={styles.subSection}>Todos ({catalog.filteredProducts.length})</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      {catalog.isLoading ? (
        <ActivityIndicator style={{ marginTop: 24 }} color={colors.primary} />
      ) : (
        <FlatList
          numColumns={2}
          data={catalog.filteredProducts}
          keyExtractor={(p) => p.id}
          refreshing={catalog.isFetching}
          onRefresh={() => void catalog.refetch()}
          ListHeaderComponent={header}
          contentContainerStyle={styles.list}
          columnWrapperStyle={{ gap: layout.catalogGap, marginBottom: layout.catalogGap }}
          renderItem={({ item }) => (
            <ProductCatalogTile
              variant="grid"
              tileWidth={layout.tileW}
              product={item}
              favorite={catalog.favoriteIds.has(item.id)}
              onToggleFavorite={() => catalog.toggleFavorite(item.id)}
              onAddPress={() => onGridProductPress(item.name)}
            />
          )}
          ListEmptyComponent={<Text style={styles.empty}>{emptyMessage}</Text>}
        />
      )}
    </View>
  );
}

function createProductsStyles(c: AppColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    list: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 32 },
    header: { paddingBottom: 8 },
    lead: { fontSize: 13, color: c.textSecondary, marginBottom: 12, lineHeight: 18 },
    leadBold: { fontWeight: "700", color: c.primary },
    searchRow: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: c.searchBackground,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: c.inputBorder,
      paddingLeft: 10,
      marginBottom: 4,
      overflow: "hidden",
    },
    searchIcon: { marginRight: 4 },
    searchInput: {
      flex: 1,
      borderWidth: 0,
      backgroundColor: "transparent",
      paddingVertical: 12,
    },
    subSection: { marginTop: 14, marginBottom: 8, fontSize: 13, fontWeight: "600", color: c.textSecondary },
    empty: { textAlign: "center", marginTop: 48, color: c.textMuted, paddingHorizontal: 24 },
  });
}
