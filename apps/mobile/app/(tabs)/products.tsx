import { ThemedText } from "@/components/atoms/ThemedText";
import { ThemedTextInput } from "@/components/atoms/ThemedTextInput";
import {
  KeyboardAvoidingScreen,
  MobileHeader,
  SafeScreen,
} from "@/components/layout";
import { MOBILE_TAB_SCROLL_BOTTOM } from "@/components/layout/MobileScreen";
import { CatalogFiltersModal } from "@/components/molecules/CatalogFiltersModal";
import { CatalogViewModeToggle } from "@/components/molecules/CatalogViewModeToggle";
import {
  CollapsibleCatalogSection,
  ProductCatalogTile,
} from "@/components/ProductCatalogViews";
import { useProductsScreen } from "@/hooks/screens/useProductsScreen";
import { useCatalogViewMode } from "@/hooks/useCatalogViewMode";
import { CATALOG_SEARCH_PLACEHOLDER } from "@/lib/catalog-search";
import { useTheme } from "@/lib/theme";
import { useRouter } from "expo-router";
import { Barcode, Search, SlidersHorizontal } from "lucide-react-native";
import { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  View,
} from "react-native";

export default function ProductsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { viewMode, toggleViewMode } = useCatalogViewMode();
  const {
    layout,
    catalog,
    onRailProductPress,
    onFavoriteRailPress,
    onGridProductPress,
    emptyMessage,
  } = useProductsScreen();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filterActive =
    catalog.categoryFilterIds.length > 0 ||
    catalog.supplierFilterIds.length > 0;

  const header = (
    <View style={styles.header}>
      <View
        style={[
          styles.searchRow,
          {
            backgroundColor: colors.searchBackground,
            borderColor: colors.inputBorder,
          },
        ]}
      >
        <Search size={20} color={colors.iconMuted} style={styles.searchIcon} />
        <ThemedTextInput
          style={styles.searchInput}
          placeholder={CATALOG_SEARCH_PLACEHOLDER}
          value={catalog.productQuery}
          onChangeText={catalog.setProductQuery}
          autoCorrect={false}
          autoCapitalize="none"
        />
        <Pressable
          accessibilityLabel="Filtros"
          style={styles.filterBtn}
          onPress={() => setFiltersOpen(true)}
        >
          <SlidersHorizontal
            size={20}
            color={colors.primary}
            strokeWidth={2.2}
          />
          {filterActive ? (
            <View
              style={[styles.filterBadge, { backgroundColor: colors.primary }]}
            />
          ) : null}
        </Pressable>
        <Pressable
          accessibilityLabel="Leitor de código de barras"
          style={[styles.barcodeBtn, { backgroundColor: colors.surfaceMuted }]}
          onPress={() => router.push("/quick-sale")}
        >
          <Barcode color={colors.primary} size={22} />
        </Pressable>
      </View>

      <CollapsibleCatalogSection
        title="Mais vendidos"
        products={catalog.topSellingProducts}
        viewMode={viewMode}
        tileWidth={layout.tileW}
        listTileWidth={layout.listTileW}
        catalogGap={layout.catalogGap}
        favoriteIds={catalog.favoriteIds}
        onToggleFavorite={catalog.toggleFavorite}
        onProductPress={() => onRailProductPress()}
      />

      <CollapsibleCatalogSection
        title="Favoritos"
        products={catalog.favoriteProductsList}
        viewMode={viewMode}
        tileWidth={layout.tileW}
        listTileWidth={layout.listTileW}
        catalogGap={layout.catalogGap}
        favoriteIds={catalog.favoriteIds}
        onToggleFavorite={catalog.toggleFavorite}
        onProductPress={() => onFavoriteRailPress()}
      />

      <ThemedText variant="titleSm" style={{ marginTop: 8 }}>
        Catálogo ({catalog.filteredProducts.length})
      </ThemedText>
    </View>
  );

  return (
    <SafeScreen variant="tab">
      <MobileHeader
        title="Catálogo"
        subtitle="Fotos e preços · use Venda rápida para pedido"
        showBack
        rightAction={
          <CatalogViewModeToggle
            viewMode={viewMode}
            onToggle={toggleViewMode}
          />
        }
      />
      {catalog.isLoading ? (
        <ActivityIndicator style={{ marginTop: 24 }} color={colors.primary} />
      ) : (
        <KeyboardAvoidingScreen>
          <FlatList
            key={viewMode}
            numColumns={viewMode === "list" ? 1 : 2}
            data={catalog.filteredProducts}
            keyExtractor={(p) => p.id}
            refreshing={catalog.isFetching}
            onRefresh={() => void catalog.refetch()}
            ListHeaderComponent={header}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            contentContainerStyle={[
              styles.list,
              { paddingBottom: MOBILE_TAB_SCROLL_BOTTOM },
            ]}
            columnWrapperStyle={
              viewMode === "list"
                ? undefined
                : { gap: layout.catalogGap, marginBottom: layout.catalogGap }
            }
            renderItem={({ item }) => (
              <ProductCatalogTile
                variant={viewMode === "list" ? "list" : "grid"}
                tileWidth={
                  viewMode === "list" ? layout.listTileW : layout.tileW
                }
                product={item}
                favorite={catalog.favoriteIds.has(item.id)}
                onToggleFavorite={() => catalog.toggleFavorite(item.id)}
                onAddPress={() => onGridProductPress(item.name)}
              />
            )}
            ListEmptyComponent={
              <ThemedText variant="bodySm" muted style={styles.empty}>
                {emptyMessage}
              </ThemedText>
            }
          />
        </KeyboardAvoidingScreen>
      )}

      <CatalogFiltersModal
        visible={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        categories={catalog.catalogCategories}
        selectedCategoryIds={catalog.categoryFilterIds}
        suppliers={catalog.catalogSuppliers}
        selectedSupplierIds={catalog.supplierFilterIds}
        onApply={({ categoryIds, supplierIds }) => {
          catalog.setCategoryFilterIds(categoryIds);
          catalog.setSupplierFilterIds(supplierIds);
        }}
      />
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: 16, paddingTop: 12, gap: 12 },
  header: { paddingBottom: 8, gap: 12 },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    paddingLeft: 12,
    minHeight: 52,
  },
  searchIcon: { marginRight: 4 },
  searchInput: {
    flex: 1,
    borderWidth: 0,
    backgroundColor: "transparent",
  },
  filterBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 4,
    position: "relative",
  },
  filterBadge: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  barcodeBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 6,
  },
  empty: { textAlign: "center", marginTop: 48, paddingHorizontal: 24 },
});
