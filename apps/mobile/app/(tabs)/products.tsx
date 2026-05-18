import { Search } from "lucide-react-native";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  CategoryFilterBar,
  HorizontalProductRail,
  ProductCatalogTile,
} from "../../components/ProductCatalogViews";
import { useProductsScreen } from "../../hooks/screens/useProductsScreen";

export default function ProductsScreen() {
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
        <Search size={18} color="#64748b" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar nome, SKU ou categoria…"
          placeholderTextColor="#94a3b8"
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
        <ActivityIndicator style={{ marginTop: 24 }} />
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  list: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 32 },
  header: { paddingBottom: 8 },
  lead: { fontSize: 13, color: "#475569", marginBottom: 12, lineHeight: 18 },
  leadBold: { fontWeight: "700", color: "#0284c7" },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    paddingLeft: 10,
    marginBottom: 4,
    overflow: "hidden",
  },
  searchIcon: { marginRight: 4 },
  searchInput: { flex: 1, paddingVertical: 12, fontSize: 16, color: "#0f172a" },
  subSection: { marginTop: 14, marginBottom: 8, fontSize: 13, fontWeight: "600", color: "#475569" },
  empty: { textAlign: "center", marginTop: 48, color: "#94a3b8", paddingHorizontal: 24 },
});
