import {
  KeyboardAvoidingScreen,
  MobileHeader,
  SafeScreen,
} from "@/components/layout";
import { AppToast } from "@/components/molecules/AppToast";
import { CatalogFiltersModal } from "@/components/molecules/CatalogFiltersModal";
import { CatalogViewModeToggle } from "@/components/molecules/CatalogViewModeToggle";
import { CATALOG_SEARCH_PLACEHOLDER } from "@/lib/catalog-search";
import {
  ChevronDown,
  ChevronUp,
  ClipboardCheck,
  Minus,
  Plus,
  ScanBarcode,
  Search,
  ShoppingCart,
  SlidersHorizontal,
} from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { BarcodeScannerModal } from "../components/BarcodeScannerModal";
import {
  CollapsibleCatalogSection,
  HorizontalProductRail,
  ProductCatalogTile,
} from "../components/ProductCatalogViews";
import { ThemedTextInput } from "../components/atoms/ThemedTextInput";
import { fmtMoney } from "../components/atoms/formatMoney";
import { useQuickSaleScreen } from "../hooks/screens/useQuickSaleScreen";
import { useCatalogViewMode } from "../hooks/useCatalogViewMode";
import { useThemedStyles } from "../hooks/useThemedStyles";
import type { SaleProduct } from "../lib/sale/types";
import { useTheme } from "../lib/theme";
import { createQuickSaleStyles } from "./_quick-sale.styles";

export default function QuickSaleScreen() {
  const styles = useThemedStyles(createQuickSaleStyles);
  const { colors } = useTheme();
  const { height: windowHeight } = useWindowDimensions();
  const { viewMode, toggleViewMode } = useCatalogViewMode();
  const s = useQuickSaleScreen();
  const { catalog, layout } = s;

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [cartExpanded, setCartExpanded] = useState(false);

  const cartExpandedMaxH = Math.min(windowHeight * 0.4, 280);
  const hasCart = s.cartLines.length > 0;
  const filterActive = catalog.categoryFilterId != null;

  useEffect(() => {
    if (!hasCart) setCartExpanded(false);
  }, [hasCart]);

  const footerHeight = useMemo(() => {
    const padBottom = Math.max(s.insets.bottom, 12);
    let h = 10 + padBottom + 56;
    if (s.err || s.creditBlockedCheckout) h += 28;
    if (hasCart) h += 52;
    if (hasCart && cartExpanded) h += cartExpandedMaxH + 8;
    return h;
  }, [
    s.insets.bottom,
    s.err,
    s.creditBlockedCheckout,
    hasCart,
    cartExpanded,
    cartExpandedMaxH,
  ]);

  const toastBottom = footerHeight + 8;

  const header = (
    <View style={styles.headerBlock}>
      <Text style={styles.sectionTitle}>Cliente</Text>
      <Text style={styles.hint}>
        Opcional — usa promoções por cliente quando existirem.
      </Text>
      <ThemedTextInput
        placeholder="Filtrar cliente…"
        value={s.customerQuery}
        onChangeText={s.setCustomerQuery}
        autoCapitalize="words"
        autoCorrect={false}
      />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.hScroll}
      >
        <Pressable
          style={[styles.pill, s.customerId === undefined && styles.pillActive]}
          onPress={() => s.setCustomerId(undefined)}
        >
          <Text
            style={[
              styles.pillText,
              s.customerId === undefined && styles.pillTextActive,
            ]}
          >
            Consumidor avulso
          </Text>
        </Pressable>
        {s.lastCustomerEntity ? (
          <Pressable
            style={[
              styles.pill,
              s.customerId !== s.lastCustomerEntity.id && styles.pillOutline,
              s.customerId === s.lastCustomerEntity.id && styles.pillActive,
            ]}
            onPress={() => s.setCustomerId(s.lastCustomerEntity!.id)}
          >
            <Text
              style={[
                styles.pillText,
                s.customerId === s.lastCustomerEntity.id &&
                  styles.pillTextActive,
              ]}
              numberOfLines={1}
            >
              Último: {s.lastCustomerEntity.name}
            </Text>
          </Pressable>
        ) : null}
        {s.filteredCustomers.map((c) => (
          <Pressable
            key={c.id}
            style={[styles.pill, s.customerId === c.id && styles.pillActive]}
            onPress={() => s.setCustomerId(c.id)}
          >
            <Text
              style={[
                styles.pillText,
                s.customerId === c.id && styles.pillTextActive,
              ]}
              numberOfLines={1}
            >
              {c.name}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
      {s.customerId ? (
        <Pressable onPress={s.openCustomerCredit} style={styles.creditLinkBtn}>
          <Text style={styles.creditLinkTxt}>
            Financeiro do cliente · limite e títulos
          </Text>
        </Pressable>
      ) : null}
      {s.creditInfo && s.customerId ? (
        <View
          style={[
            styles.creditBanner,
            s.creditInfo.effectiveAction === "BLOCK"
              ? styles.creditBannerDanger
              : styles.creditBannerWarn,
          ]}
        >
          <Text style={styles.creditBannerTitle}>Situação de crédito</Text>
          {s.creditInfo.creditBlocked ? (
            <Text style={styles.creditBannerTxt}>
              • Cliente bloqueado pelo escritório.
            </Text>
          ) : null}
          <Text style={styles.creditBannerTxt}>
            • Em aberto: R$ {fmtMoney(s.creditInfo.openBalance)}
            {s.creditInfo.creditLimit != null
              ? ` · Limite R$ ${fmtMoney(s.creditInfo.creditLimit)}`
              : ""}
          </Text>
          {s.creditInfo.overdueCount > 0 ? (
            <Text style={styles.creditBannerTxt}>
              • {s.creditInfo.overdueCount} título(s) vencido(s) · R${" "}
              {fmtMoney(s.creditInfo.overdueAmount)}
            </Text>
          ) : null}
          {s.creditInfo.violations.map((v, i) => (
            <Text key={`${v.code}-${i}`} style={styles.creditBannerTxt}>
              • {v.message}
            </Text>
          ))}
          {s.creditInfo.effectiveAction === "BLOCK" ? (
            <Text style={styles.creditBannerBold}>
              Não é possível confirmar este pedido.
            </Text>
          ) : s.creditInfo.effectiveAction === "APPROVAL" &&
            s.creditInfo.violations.length > 0 ? (
            <Text style={styles.creditBannerBold}>
              Este pedido pode ser enviado para aprovação no escritório.
            </Text>
          ) : null}
        </View>
      ) : s.creditLoading && s.customerId ? (
        <ActivityIndicator
          style={{ marginVertical: 10 }}
          color={colors.primary}
        />
      ) : null}

      <Text style={[styles.sectionTitle, { marginTop: 8 }]}>
        Catálogo visual
      </Text>
      <View style={styles.searchRow}>
        <Search size={18} color={colors.iconMuted} style={styles.searchIcon} />
        <ThemedTextInput
          style={styles.searchInput}
          placeholder={CATALOG_SEARCH_PLACEHOLDER}
          value={catalog.productQuery}
          onChangeText={catalog.setProductQuery}
          autoCorrect={false}
          autoCapitalize="none"
        />
        <Pressable
          style={styles.filterBtn}
          onPress={() => setFiltersOpen(true)}
          accessibilityLabel="Filtros"
        >
          <SlidersHorizontal
            size={20}
            color={colors.primary}
            strokeWidth={2.2}
          />
          {filterActive ? <View style={styles.filterBadge} /> : null}
        </Pressable>
        <Pressable
          style={styles.scanBtn}
          onPress={() => s.setBarcodeOpen(true)}
        >
          <ScanBarcode
            size={22}
            color={colors.primaryForeground}
            strokeWidth={2.2}
          />
        </Pressable>
      </View>
      <Text style={styles.microHint}>
        Toque na foto para adicionar 1 · dois toques rápidos somam 2. Coração
        guarda nos favoritos (neste aparelho).
      </Text>

      <CollapsibleCatalogSection
        title="Mais vendidos"
        products={catalog.topSellingProducts}
        viewMode={viewMode}
        tileWidth={layout.tileW}
        listTileWidth={layout.listTileW}
        catalogGap={layout.catalogGap}
        favoriteIds={catalog.favoriteIds}
        onToggleFavorite={catalog.toggleFavorite}
        onProductPress={(p) => s.scheduleProductTap(p as SaleProduct)}
        qtyByProductId={s.cartQtyByProductId}
      />

      <HorizontalProductRail
        title="Favoritos"
        products={catalog.favoriteProductsList}
        tileWidth={layout.railTileW}
        favoriteIds={catalog.favoriteIds}
        onToggleFavorite={catalog.toggleFavorite}
        onProductPress={(p) => s.scheduleProductTap(p as SaleProduct)}
        qtyByProductId={s.cartQtyByProductId}
      />

      <Text style={styles.subSection}>
        Todos ({catalog.filteredProducts.length})
      </Text>
    </View>
  );

  return (
    <SafeScreen variant="topOnly">
      <MobileHeader
        title="Venda rápida"
        subtitle="Montar pedido e carrinho"
        showBack
        rightAction={
          <CatalogViewModeToggle
            viewMode={viewMode}
            onToggle={toggleViewMode}
          />
        }
      />
      <KeyboardAvoidingScreen style={styles.flex} offset={8}>
        <FlatList
          key={viewMode}
          numColumns={viewMode === "list" ? 1 : 2}
          data={catalog.filteredProducts}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={header}
          ListFooterComponent={<View style={{ height: footerHeight + 16 }} />}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          columnWrapperStyle={
            viewMode === "list"
              ? undefined
              : { gap: layout.catalogGap, marginBottom: layout.catalogGap }
          }
          renderItem={({ item: p }) => (
            <ProductCatalogTile
              variant={viewMode === "list" ? "list" : "grid"}
              tileWidth={viewMode === "list" ? layout.listTileW : layout.tileW}
              product={p}
              favorite={catalog.favoriteIds.has(p.id)}
              onToggleFavorite={() => catalog.toggleFavorite(p.id)}
              onAddPress={() => s.scheduleProductTap(p)}
              qtyInCart={s.cartQtyByProductId[p.id]}
            />
          )}
          ListEmptyComponent={
            <Text style={styles.warn}>{s.emptyCatalogMessage}</Text>
          }
        />

        <AppToast
          visible={!!s.scanMsg}
          message={s.scanMsg ?? ""}
          tone={s.scanMsgOk ? "success" : "warning"}
          onDismiss={s.clearScanMsg}
          bottomOffset={toastBottom}
        />

        <View
          style={[
            styles.footer,
            { paddingBottom: Math.max(s.insets.bottom, 12) },
          ]}
        >
          {hasCart ? (
            <>
              <Pressable
                style={styles.cartSummaryBtn}
                onPress={() => setCartExpanded((v) => !v)}
                accessibilityRole="button"
                accessibilityState={{ expanded: cartExpanded }}
                accessibilityLabel="Carrinho"
              >
                <ShoppingCart
                  size={18}
                  color={colors.primary}
                  strokeWidth={2.2}
                />
                <Text style={styles.cartSummaryText} numberOfLines={1}>
                  Carrinho · {s.cartLines.length}{" "}
                  {s.cartLines.length === 1 ? "item" : "itens"}
                </Text>
                <Text style={styles.cartSummaryMeta} numberOfLines={1}>
                  R$ {fmtMoney(s.cartTotal)}
                </Text>
                {cartExpanded ? (
                  <ChevronDown size={20} color={colors.textSecondary} />
                ) : (
                  <ChevronUp size={20} color={colors.textSecondary} />
                )}
              </Pressable>
              {cartExpanded ? (
                <View
                  style={[
                    styles.cartExpandedPanel,
                    { maxHeight: cartExpandedMaxH },
                  ]}
                >
                  <ScrollView
                    style={styles.cartExpandedScroll}
                    nestedScrollEnabled
                    keyboardShouldPersistTaps="handled"
                  >
                    {s.cartLines.map((line) => (
                      <View key={line.productId} style={styles.cartRow}>
                        <View style={styles.cartMain}>
                          <Text style={styles.cartName} numberOfLines={2}>
                            {line.name}
                          </Text>
                          <Text style={styles.cartMeta}>
                            R$ {fmtMoney(line.effectiveUnitPrice)}
                            {line.discountPercent > 0
                              ? ` · −${line.discountPercent}%`
                              : ""}
                            {" · "}Subtotal R$ {fmtMoney(s.cartLineTotal(line))}
                          </Text>
                        </View>
                        <View style={styles.cartActions}>
                          <View style={styles.qtyRow}>
                            <Pressable
                              hitSlop={8}
                              style={styles.iconBtn}
                              onPress={() =>
                                s.bumpQty(s.cartProductStub(line), -1)
                              }
                            >
                              <Minus
                                size={20}
                                color={colors.text}
                                strokeWidth={2.5}
                              />
                            </Pressable>
                            <Text style={styles.qtyTxt}>{line.qty}</Text>
                            <Pressable
                              hitSlop={8}
                              style={styles.iconBtn}
                              onPress={() =>
                                s.bumpQty(s.cartProductStub(line), 1)
                              }
                            >
                              <Plus
                                size={20}
                                color={colors.text}
                                strokeWidth={2.5}
                              />
                            </Pressable>
                          </View>
                          <Pressable
                            style={styles.discBtn}
                            onPress={() => s.cycleDiscount(line.productId)}
                          >
                            <Text style={styles.discBtnTxt}>
                              Desc. {line.discountPercent}%
                            </Text>
                          </Pressable>
                        </View>
                      </View>
                    ))}
                  </ScrollView>
                </View>
              ) : null}
            </>
          ) : null}

          {s.err ? <Text style={styles.errFoot}>{s.err}</Text> : null}
          {s.creditBlockedCheckout ? (
            <Text style={styles.errFoot}>
              Pedido bloqueado pela política de crédito.
            </Text>
          ) : null}
          <Pressable
            style={[
              styles.finalBtn,
              (s.cartLines.length === 0 ||
                s.create.isPending ||
                s.creditBlockedCheckout) &&
                styles.finalBtnDis,
            ]}
            disabled={
              s.cartLines.length === 0 ||
              s.create.isPending ||
              s.creditBlockedCheckout
            }
            onPress={s.finalize}
          >
            {s.create.isPending ? (
              <ActivityIndicator color={colors.primaryForeground} />
            ) : (
              <View style={styles.finalInner}>
                <ClipboardCheck
                  color={colors.primaryForeground}
                  size={22}
                  strokeWidth={2}
                />
                <Text style={styles.finalTxt}>
                  Finalizar · R$ {fmtMoney(s.cartTotal)}
                </Text>
              </View>
            )}
          </Pressable>
        </View>

        <BarcodeScannerModal
          visible={s.barcodeOpen}
          onClose={() => s.setBarcodeOpen(false)}
          onBarcode={s.onBarcode}
        />

        <CatalogFiltersModal
          visible={filtersOpen}
          onClose={() => setFiltersOpen(false)}
          categories={catalog.catalogCategories}
          selectedCategoryId={catalog.categoryFilterId}
          onApply={catalog.setCategoryFilterId}
        />
      </KeyboardAvoidingScreen>
    </SafeScreen>
  );
}
