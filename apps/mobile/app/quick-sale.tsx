import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { ClipboardCheck, Minus, Plus, ScanBarcode, Search } from "lucide-react-native";
import {
  CategoryFilterBar,
  HorizontalProductRail,
  ProductCatalogTile,
} from "../components/ProductCatalogViews";
import { BarcodeScannerModal } from "../components/BarcodeScannerModal";
import { fmtMoney } from "../components/atoms/formatMoney";
import { useQuickSaleScreen } from "../hooks/screens/useQuickSaleScreen";
import type { SaleProduct } from "../lib/sale/types";

export default function QuickSaleScreen() {
  const s = useQuickSaleScreen();
  const { catalog, layout } = s;

  const header = (
    <View style={styles.headerBlock}>
      <Text style={styles.sectionTitle}>Cliente</Text>
      <Text style={styles.hint}>Opcional — usa promoções por cliente quando existirem.</Text>
      <TextInput
        style={styles.input}
        placeholder="Filtrar cliente…"
        placeholderTextColor="#94a3b8"
        value={s.customerQuery}
        onChangeText={s.setCustomerQuery}
        autoCapitalize="words"
        autoCorrect={false}
      />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.hScroll}>
        <Pressable
          style={[styles.pill, s.customerId === undefined && styles.pillActive]}
          onPress={() => s.setCustomerId(undefined)}
        >
          <Text style={[styles.pillText, s.customerId === undefined && styles.pillTextActive]}>
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
                s.customerId === s.lastCustomerEntity.id && styles.pillTextActive,
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
            <Text style={[styles.pillText, s.customerId === c.id && styles.pillTextActive]}>{c.name}</Text>
          </Pressable>
        ))}
      </ScrollView>
      {s.customerId ? (
        <Pressable onPress={s.openCustomerCredit} style={styles.creditLinkBtn}>
          <Text style={styles.creditLinkTxt}>Financeiro do cliente · limite e títulos</Text>
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
            <Text style={styles.creditBannerTxt}>• Cliente bloqueado pelo escritório.</Text>
          ) : null}
          <Text style={styles.creditBannerTxt}>
            • Em aberto: R$ {fmtMoney(s.creditInfo.openBalance)}
            {s.creditInfo.creditLimit != null ? ` · Limite R$ ${fmtMoney(s.creditInfo.creditLimit)}` : ""}
          </Text>
          {s.creditInfo.overdueCount > 0 ? (
            <Text style={styles.creditBannerTxt}>
              • {s.creditInfo.overdueCount} título(s) vencido(s) · R$ {fmtMoney(s.creditInfo.overdueAmount)}
            </Text>
          ) : null}
          {s.creditInfo.violations.map((v, i) => (
            <Text key={`${v.code}-${i}`} style={styles.creditBannerTxt}>
              • {v.message}
            </Text>
          ))}
          {s.creditInfo.effectiveAction === "BLOCK" ? (
            <Text style={styles.creditBannerBold}>Não é possível confirmar este pedido.</Text>
          ) : s.creditInfo.effectiveAction === "APPROVAL" && s.creditInfo.violations.length > 0 ? (
            <Text style={styles.creditBannerBold}>
              Este pedido pode ser enviado para aprovação no escritório.
            </Text>
          ) : null}
        </View>
      ) : s.creditLoading && s.customerId ? (
        <ActivityIndicator style={{ marginVertical: 10 }} color="#0284c7" />
      ) : null}

      {s.cartLines.length > 0 ? (
        <View style={styles.cartSection}>
          <Text style={styles.sectionTitle}>Carrinho ({s.cartLines.length})</Text>
          {s.cartLines.map((line) => (
            <View key={line.productId} style={styles.cartRow}>
              <View style={styles.cartMain}>
                <Text style={styles.cartName} numberOfLines={2}>
                  {line.name}
                </Text>
                <Text style={styles.cartMeta}>
                  R$ {fmtMoney(line.effectiveUnitPrice)}
                  {line.discountPercent > 0 ? ` · −${line.discountPercent}%` : ""}
                  {" · "}Subtotal R$ {fmtMoney(s.cartLineTotal(line))}
                </Text>
              </View>
              <View style={styles.cartActions}>
                <View style={styles.qtyRow}>
                  <Pressable
                    hitSlop={8}
                    style={styles.iconBtn}
                    onPress={() => s.bumpQty(s.cartProductStub(line), -1)}
                  >
                    <Minus size={20} color="#0f172a" strokeWidth={2.5} />
                  </Pressable>
                  <Text style={styles.qtyTxt}>{line.qty}</Text>
                  <Pressable
                    hitSlop={8}
                    style={styles.iconBtn}
                    onPress={() => s.bumpQty(s.cartProductStub(line), 1)}
                  >
                    <Plus size={20} color="#0f172a" strokeWidth={2.5} />
                  </Pressable>
                </View>
                <Pressable style={styles.discBtn} onPress={() => s.cycleDiscount(line.productId)}>
                  <Text style={styles.discBtnTxt}>Desc. {line.discountPercent}%</Text>
                </Pressable>
              </View>
            </View>
          ))}
          <Text style={styles.cartTotal}>Total R$ {fmtMoney(s.cartTotal)}</Text>
        </View>
      ) : null}

      <Text style={[styles.sectionTitle, { marginTop: s.cartLines.length ? 12 : 8 }]}>Catálogo visual</Text>
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
        <Pressable style={styles.scanBtn} onPress={() => s.setBarcodeOpen(true)}>
          <ScanBarcode size={22} color="#fff" strokeWidth={2.2} />
        </Pressable>
      </View>
      <Text style={styles.microHint}>
        Toque na foto para adicionar 1 · dois toques rápidos somam 2. Coração guarda nos favoritos (neste aparelho).
      </Text>
      {s.scanMsg ? <Text style={styles.scanWarn}>{s.scanMsg}</Text> : null}

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

      <Text style={styles.subSection}>Todos ({catalog.filteredProducts.length})</Text>
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={s.insets.top + 52}
    >
      <FlatList
        numColumns={2}
        data={catalog.filteredProducts}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={header}
        ListFooterComponent={<View style={{ height: s.footerPad }} />}
        contentContainerStyle={styles.listContent}
        columnWrapperStyle={{ gap: layout.catalogGap, marginBottom: layout.catalogGap }}
        renderItem={({ item: p }) => (
          <ProductCatalogTile
            variant="grid"
            tileWidth={layout.tileW}
            product={p}
            favorite={catalog.favoriteIds.has(p.id)}
            onToggleFavorite={() => catalog.toggleFavorite(p.id)}
            onAddPress={() => s.scheduleProductTap(p)}
            qtyInCart={s.cartQtyByProductId[p.id]}
          />
        )}
        ListEmptyComponent={<Text style={styles.warn}>{s.emptyCatalogMessage}</Text>}
      />

      <View style={[styles.footer, { paddingBottom: Math.max(s.insets.bottom, 12) }]}>
        {s.err ? <Text style={styles.errFoot}>{s.err}</Text> : null}
        {s.creditBlockedCheckout ? (
          <Text style={styles.errFoot}>Pedido bloqueado pela política de crédito.</Text>
        ) : null}
        <Pressable
          style={[
            styles.finalBtn,
            (s.cartLines.length === 0 || s.create.isPending || s.creditBlockedCheckout) && styles.finalBtnDis,
          ]}
          disabled={s.cartLines.length === 0 || s.create.isPending || s.creditBlockedCheckout}
          onPress={s.finalize}
        >
          {s.create.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <View style={styles.finalInner}>
              <ClipboardCheck color="#fff" size={22} strokeWidth={2} />
              <Text style={styles.finalTxt}>Finalizar · R$ {fmtMoney(s.cartTotal)}</Text>
            </View>
          )}
        </Pressable>
      </View>

      <BarcodeScannerModal
        visible={s.barcodeOpen}
        onClose={() => s.setBarcodeOpen(false)}
        onBarcode={s.onBarcode}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: "#f8fafc" },
  listContent: { paddingHorizontal: 16, paddingTop: 12 },
  headerBlock: { paddingBottom: 8 },
  sectionTitle: { fontSize: 17, fontWeight: "700", color: "#0f172a" },
  subSection: { marginTop: 14, marginBottom: 8, fontSize: 13, fontWeight: "600", color: "#475569" },
  hint: { marginTop: 4, marginBottom: 10, fontSize: 12, color: "#64748b" },
  input: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    backgroundColor: "#fff",
    marginBottom: 10,
  },
  hScroll: { marginBottom: 4 },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
    backgroundColor: "#e2e8f0",
    marginRight: 8,
    marginBottom: 8,
  },
  pillActive: { backgroundColor: "#0284c7" },
  pillOutline: {
    backgroundColor: "#fff",
    borderWidth: 1.5,
    borderColor: "#38bdf8",
  },
  pillText: { color: "#334155", fontSize: 14, fontWeight: "500" },
  pillTextActive: { color: "#fff", fontWeight: "700" },
  cartSection: {
    marginTop: 14,
    padding: 12,
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    gap: 10,
  },
  cartRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e2e8f0",
  },
  cartMain: { flex: 1 },
  cartName: { fontSize: 15, fontWeight: "600", color: "#0f172a" },
  cartMeta: { marginTop: 4, fontSize: 12, color: "#64748b" },
  cartActions: { alignItems: "flex-end", gap: 8 },
  qtyRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
  },
  qtyTxt: { fontSize: 16, fontWeight: "700", color: "#0f172a", minWidth: 22, textAlign: "center" },
  discBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "#fef3c7",
    borderWidth: 1,
    borderColor: "#fcd34d",
  },
  discBtnTxt: { fontSize: 12, fontWeight: "700", color: "#92400e" },
  cartTotal: { marginTop: 4, fontSize: 17, fontWeight: "800", color: "#047857", textAlign: "right" },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    paddingLeft: 10,
    marginTop: 8,
    overflow: "hidden",
  },
  searchIcon: { marginRight: 4 },
  searchInput: { flex: 1, paddingVertical: 12, fontSize: 16, color: "#0f172a" },
  scanBtn: {
    backgroundColor: "#0284c7",
    paddingHorizontal: 14,
    paddingVertical: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  scanWarn: { color: "#b45309", marginTop: 8, fontSize: 13 },
  microHint: { marginTop: 8, fontSize: 11, color: "#64748b", lineHeight: 15 },
  warn: { paddingVertical: 24, color: "#b45309", textAlign: "center" },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 10,
    backgroundColor: "#f8fafcf2",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#e2e8f0",
  },
  errFoot: { color: "#dc2626", marginBottom: 8, textAlign: "center", fontSize: 13 },
  creditLinkBtn: {
    alignSelf: "flex-start",
    marginTop: 6,
    marginBottom: 6,
    paddingVertical: 6,
    paddingHorizontal: 2,
  },
  creditLinkTxt: { fontSize: 13, fontWeight: "700", color: "#0369a1", textDecorationLine: "underline" },
  creditBanner: {
    marginTop: 6,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  creditBannerWarn: { backgroundColor: "#fffbeb", borderColor: "#fcd34d" },
  creditBannerDanger: { backgroundColor: "#fef2f2", borderColor: "#fca5a5" },
  creditBannerTitle: { fontSize: 14, fontWeight: "800", color: "#0f172a", marginBottom: 6 },
  creditBannerTxt: { fontSize: 12, color: "#334155", marginBottom: 4 },
  creditBannerBold: { marginTop: 8, fontSize: 13, fontWeight: "800", color: "#991b1b" },
  finalBtn: {
    backgroundColor: "#0284c7",
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: "center",
  },
  finalBtnDis: { opacity: 0.45 },
  finalInner: { flexDirection: "row", alignItems: "center", gap: 10 },
  finalTxt: { color: "#fff", fontWeight: "800", fontSize: 17 },
});
