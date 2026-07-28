import { AuditLogPanel } from "@/components/AuditLogPanel";
import {
  FormActions,
  FormErrorBanner,
  FormField,
  FormGrid,
  FormSection,
} from "@/components/forms";
import { AppSelect } from "@/components/ui/app-select";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useProductFormPage } from "@/hooks/useProductFormPage";
import { useScrollToFirstError } from "@/hooks/useScrollToFirstError";
import { cn } from "@/lib/utils";
import {
  PRODUCT_CLASSIFICATIONS,
  PURCHASE_UNITS,
  productClassificationLabel,
  type ProductClassification,
  type ProductFormTab,
} from "@pedidos/shared";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { DynamicCategoryAttributes } from "../components/DynamicCategoryAttributes";
import { ProductPromotionsPanel } from "../components/ProductPromotionsPanel";
import { apiFetch } from "../lib/api";

type FiscalOpOption = {
  id: string;
  direction: string;
  cfop: string;
  description: string;
  active: boolean;
};

const TABS: { id: ProductFormTab; label: string }[] = [
  { id: "principal", label: "Principal" },
  { id: "precos", label: "Preços" },
  { id: "comissoes", label: "Comissões" },
  { id: "estoque", label: "Estoque e logística" },
  { id: "fiscal", label: "Fiscal" },
  { id: "fornecedor", label: "Fornecedor" },
  { id: "atributos", label: "Atributos do grupo" },
];

function formatCnpj(digits: string): string {
  const d = digits.replace(/\D/g, "");
  if (d.length !== 14) return digits;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

function formatDateBr(iso: string | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR");
}

export function ProductFormPage() {
  const {
    productId,
    isEdit,
    isLoading,
    isError,
    loadError,
    product,
    activeTab,
    setActiveTab,
    values,
    setField,
    attrs,
    setAttrs,
    formError,
    fieldErrors,
    fieldError,
    categories,
    suppliers,
    selectedDefs,
    selectedSupplier,
    markupPercent,
    handleSubmit,
    onCategoryChange,
    pending,
  } = useProductFormPage();

  useScrollToFirstError(
    Object.keys(fieldErrors).length > 0 ? fieldErrors : formError,
  );

  const { data: outboundOps = [] } = useQuery({
    queryKey: ["admin", "fiscal", "operations", "OUTBOUND"],
    queryFn: () =>
      apiFetch<FiscalOpOption[]>("/admin/fiscal/operations?direction=OUTBOUND"),
  });

  if (isEdit && isLoading) {
    return (
      <div className="space-y-4">
        <Link to="/produtos" className="text-sm text-primary hover:underline">
          ← Voltar para produtos
        </Link>
        <p className="text-muted-foreground">Carregando produto…</p>
      </div>
    );
  }

  if (isEdit && (isError || !product)) {
    const msg =
      loadError instanceof Error
        ? loadError.message
        : "Produto não encontrado.";
    return (
      <div className="space-y-4">
        <Link to="/produtos" className="text-sm text-primary hover:underline">
          ← Voltar para produtos
        </Link>
        <p className="text-destructive">{msg}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div>
        <Link to="/produtos" className="text-sm text-primary hover:underline">
          ← Voltar para produtos
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-foreground">
          {isEdit ? "Editar produto" : "Novo produto"}
        </h1>
        {isEdit && product ? (
          <p className="mt-1 text-sm text-muted-foreground">{product.name}</p>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-1 border-b border-border">
        {TABS.map((tab) => {
          if (tab.id === "atributos" && selectedDefs.length === 0) return null;
          return (
            <button
              key={tab.id}
              type="button"
              className={cn(
                "border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                activeTab === tab.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
              {tab.id === "fornecedor" && selectedSupplier ? (
                <span className="ml-1 text-xs text-muted-foreground">
                  ({selectedSupplier.tradeName})
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      <form onSubmit={(e) => void handleSubmit(e)}>
        <FormErrorBanner message={formError} className="mb-4" />

        {activeTab === "principal" ? (
          <FormSection
            title="Dados principais"
            description="Identificação, classificação e descrição do produto."
          >
            {isEdit && product ? (
              <FormGrid cols={2} className="mb-4">
                <FormField label="Código interno" htmlFor="prod-id">
                  <Input id="prod-id" value={product.id} readOnly disabled />
                </FormField>
                <FormField label="Data de cadastro" htmlFor="prod-created">
                  <Input
                    id="prod-created"
                    value={formatDateBr(product.createdAt)}
                    readOnly
                    disabled
                  />
                </FormField>
              </FormGrid>
            ) : null}

            <FormGrid cols={2}>
              <FormField
                label="Nome"
                htmlFor="prod-name"
                required
                className="sm:col-span-2"
                error={fieldError("name")}
              >
                <Input
                  id="prod-name"
                  placeholder="Ex.: Pimentinha Saltbits"
                  value={values.name}
                  onChange={(e) => setField("name", e.target.value)}
                  autoComplete="off"
                />
              </FormField>

              <FormField
                label="Grupo de produtos"
                htmlFor="prod-category"
                required
                className="sm:col-span-2"
                error={fieldError("categoryId")}
                hint={
                  <>
                    Configure schemas em{" "}
                    <Link
                      to="/produtos/categorias"
                      className="text-primary hover:underline"
                    >
                      grupos de produto
                    </Link>
                    .
                  </>
                }
              >
                <AppSelect
                  id="prod-category"
                  value={values.categoryId}
                  emptyLabel="Selecione um grupo…"
                  placeholder="Selecione um grupo…"
                  options={categories.map((c) => ({
                    value: c.id,
                    label: `${c.name} (${c.code})`,
                  }))}
                  onValueChange={onCategoryChange}
                />
              </FormField>

              <FormField label="Linha" htmlFor="prod-line">
                <Input
                  id="prod-line"
                  placeholder="Ex.: Linha 1"
                  value={values.productLine}
                  onChange={(e) => setField("productLine", e.target.value)}
                />
              </FormField>

              <FormField label="Classificação" htmlFor="prod-classification">
                <AppSelect
                  id="prod-classification"
                  value={values.productClassification}
                  emptyLabel="Selecione…"
                  placeholder="Selecione…"
                  options={PRODUCT_CLASSIFICATIONS.map((c) => ({
                    value: c,
                    label: productClassificationLabel(c),
                  }))}
                  onValueChange={(v) =>
                    setField(
                      "productClassification",
                      (v as ProductClassification) || "",
                    )
                  }
                />
              </FormField>

              <FormField
                label="SKU"
                htmlFor="prod-sku"
                error={fieldError("sku")}
              >
                <Input
                  id="prod-sku"
                  placeholder="Código interno opcional"
                  value={values.sku}
                  onChange={(e) => setField("sku", e.target.value)}
                />
              </FormField>

              <FormField
                label="Código de barras"
                htmlFor="prod-barcode"
                hint="EAN/GTIN usado pelo leitor na venda rápida."
                error={fieldError("barcode")}
              >
                <Input
                  id="prod-barcode"
                  placeholder="7891234567890"
                  value={values.barcode}
                  onChange={(e) => setField("barcode", e.target.value)}
                  inputMode="numeric"
                />
              </FormField>

              <FormField
                label="Descrição"
                htmlFor="prod-desc"
                className="sm:col-span-2"
              >
                <Textarea
                  id="prod-desc"
                  rows={4}
                  value={values.description}
                  onChange={(e) => setField("description", e.target.value)}
                />
              </FormField>

              <FormField
                label="URL da foto (catálogo no app)"
                htmlFor="prod-image-url"
                className="sm:col-span-2"
                error={fieldError("imageUrl")}
              >
                <Input
                  id="prod-image-url"
                  type="url"
                  placeholder="https://… (opcional)"
                  value={values.imageUrl}
                  onChange={(e) => setField("imageUrl", e.target.value)}
                />
              </FormField>
            </FormGrid>
          </FormSection>
        ) : null}

        {activeTab === "precos" ? (
          <FormSection
            title="Preços"
            description="Valores de custo, venda e limites comerciais."
          >
            <FormGrid cols={2}>
              <FormField
                label="Preço custo (R$)"
                htmlFor="prod-cost"
                error={fieldError("costPrice")}
              >
                <Input
                  id="prod-cost"
                  type="number"
                  step="0.01"
                  min="0"
                  value={values.costPrice}
                  onChange={(e) => setField("costPrice", e.target.value)}
                />
              </FormField>

              <FormField
                label="Preço fábrica (R$)"
                htmlFor="prod-factory"
                error={fieldError("factoryPrice")}
              >
                <Input
                  id="prod-factory"
                  type="number"
                  step="0.01"
                  min="0"
                  value={values.factoryPrice}
                  onChange={(e) => setField("factoryPrice", e.target.value)}
                />
              </FormField>

              <FormField
                label="Preço venda (R$)"
                htmlFor="prod-price"
                required
                error={fieldError("basePrice")}
                hint="Usado quando não há preço em tabela de preços."
              >
                <Input
                  id="prod-price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={values.basePrice}
                  onChange={(e) => setField("basePrice", e.target.value)}
                />
              </FormField>

              <FormField
                label="Preço máximo (R$)"
                htmlFor="prod-max-sale"
                error={fieldError("maxSalePrice")}
              >
                <Input
                  id="prod-max-sale"
                  type="number"
                  step="0.01"
                  min="0"
                  value={values.maxSalePrice}
                  onChange={(e) => setField("maxSalePrice", e.target.value)}
                />
              </FormField>

              <FormField
                label="Preço mínimo de venda (R$)"
                htmlFor="prod-min-sale"
                error={fieldError("minSaleUnitPrice")}
                hint="Piso por unidade após promoções e desconto do vendedor."
              >
                <Input
                  id="prod-min-sale"
                  type="number"
                  step="0.01"
                  min="0"
                  value={values.minSaleUnitPrice}
                  onChange={(e) => setField("minSaleUnitPrice", e.target.value)}
                />
              </FormField>

              <FormField
                label="Desconto máx. vendedor (%)"
                htmlFor="prod-max-disc"
                error={fieldError("maxSellerDiscountPercent")}
              >
                <Input
                  id="prod-max-disc"
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={values.maxSellerDiscountPercent}
                  onChange={(e) =>
                    setField("maxSellerDiscountPercent", e.target.value)
                  }
                />
              </FormField>

              <FormField
                label="Frete (R$)"
                htmlFor="prod-freight"
                error={fieldError("freightAmount")}
              >
                <Input
                  id="prod-freight"
                  type="number"
                  step="0.01"
                  min="0"
                  value={values.freightAmount}
                  onChange={(e) => setField("freightAmount", e.target.value)}
                />
              </FormField>

              <FormField label="Mark-up (%)" htmlFor="prod-markup">
                <Input
                  id="prod-markup"
                  value={
                    markupPercent != null
                      ? markupPercent.toFixed(2).replace(".", ",")
                      : "—"
                  }
                  readOnly
                  disabled
                  className="bg-muted/50"
                />
              </FormField>
            </FormGrid>
          </FormSection>
        ) : null}

        {activeTab === "comissoes" ? (
          <FormSection
            title="Comissões"
            description="Percentuais quando o vendedor usa comissão por produto."
          >
            <FormGrid cols={2}>
              <FormField
                label="Comissão venda (%)"
                htmlFor="prod-commission"
                error={fieldError("commissionPercent")}
              >
                <Input
                  id="prod-commission"
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={values.commissionPercent}
                  onChange={(e) =>
                    setField("commissionPercent", e.target.value)
                  }
                />
              </FormField>

              <FormField
                label="Comissão cobrança (%)"
                htmlFor="prod-collection-commission"
                error={fieldError("collectionCommissionPercent")}
              >
                <Input
                  id="prod-collection-commission"
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={values.collectionCommissionPercent}
                  onChange={(e) =>
                    setField("collectionCommissionPercent", e.target.value)
                  }
                />
              </FormField>
            </FormGrid>
          </FormSection>
        ) : null}

        {activeTab === "estoque" ? (
          <FormSection
            title="Estoque e logística"
            description="Quantidades, limites e dados de embalagem."
          >
            <FormGrid cols={2}>
              <FormField
                label="Estoque atual"
                htmlFor="prod-stock"
                required={!isEdit}
                error={fieldError("stockQty")}
              >
                <Input
                  id="prod-stock"
                  type="number"
                  min="0"
                  step="1"
                  value={values.stockQty}
                  onChange={(e) => setField("stockQty", e.target.value)}
                  disabled={isEdit}
                />
                {isEdit ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Para alterar saldo com lote/validade, use{" "}
                    <Link className="underline" to="/estoque">
                      Estoque
                    </Link>
                    .
                  </p>
                ) : null}
              </FormField>

              <FormField
                label="Estoque mínimo"
                htmlFor="prod-min-stock"
                error={fieldError("minStockQty")}
              >
                <Input
                  id="prod-min-stock"
                  type="number"
                  min="0"
                  step="1"
                  value={values.minStockQty}
                  onChange={(e) => setField("minStockQty", e.target.value)}
                />
              </FormField>

              <FormField
                label="Qtd. máxima"
                htmlFor="prod-max-stock"
                error={fieldError("maxStockQty")}
              >
                <Input
                  id="prod-max-stock"
                  type="number"
                  min="0"
                  step="1"
                  value={values.maxStockQty}
                  onChange={(e) => setField("maxStockQty", e.target.value)}
                />
              </FormField>

              <FormField
                label="Endereço no estoque"
                htmlFor="prod-stock-addr"
                className="sm:col-span-2"
              >
                <Input
                  id="prod-stock-addr"
                  placeholder="Corredor, prateleira, posição…"
                  value={values.stockAddress}
                  onChange={(e) => setField("stockAddress", e.target.value)}
                />
              </FormField>

              <FormField label="Und. compra" htmlFor="prod-purchase-unit">
                <AppSelect
                  id="prod-purchase-unit"
                  value={values.purchaseUnit}
                  emptyLabel="Selecione…"
                  placeholder="Selecione…"
                  options={PURCHASE_UNITS.map((u) => ({
                    value: u.value,
                    label: u.label,
                  }))}
                  onValueChange={(v) => setField("purchaseUnit", v)}
                />
              </FormField>

              <FormField
                label="Caixa padrão compra"
                htmlFor="prod-purchase-box"
                error={fieldError("standardPurchaseBoxQty")}
              >
                <Input
                  id="prod-purchase-box"
                  type="number"
                  min="1"
                  step="1"
                  value={values.standardPurchaseBoxQty}
                  onChange={(e) =>
                    setField("standardPurchaseBoxQty", e.target.value)
                  }
                />
              </FormField>

              <FormField
                label="Peso bruto (kg)"
                htmlFor="prod-gross-weight"
                error={fieldError("grossWeightKg")}
              >
                <Input
                  id="prod-gross-weight"
                  type="number"
                  step="0.001"
                  min="0"
                  value={values.grossWeightKg}
                  onChange={(e) => setField("grossWeightKg", e.target.value)}
                />
              </FormField>

              <FormField
                label="Peso líquido (kg)"
                htmlFor="prod-net-weight"
                error={fieldError("netWeightKg")}
              >
                <Input
                  id="prod-net-weight"
                  type="number"
                  step="0.001"
                  min="0"
                  value={values.netWeightKg}
                  onChange={(e) => setField("netWeightKg", e.target.value)}
                />
              </FormField>

              <FormField
                label="Qtd. máx./dia vendedor"
                htmlFor="prod-max-seller-day"
                error={fieldError("maxDailyQtyPerSeller")}
              >
                <Input
                  id="prod-max-seller-day"
                  type="number"
                  min="1"
                  step="1"
                  value={values.maxDailyQtyPerSeller}
                  onChange={(e) =>
                    setField("maxDailyQtyPerSeller", e.target.value)
                  }
                />
              </FormField>

              <FormField
                label="Qtd. máx./dia cliente"
                htmlFor="prod-max-customer-day"
                error={fieldError("maxDailyQtyPerCustomer")}
              >
                <Input
                  id="prod-max-customer-day"
                  type="number"
                  min="1"
                  step="1"
                  value={values.maxDailyQtyPerCustomer}
                  onChange={(e) =>
                    setField("maxDailyQtyPerCustomer", e.target.value)
                  }
                />
              </FormField>

              <FormField
                label="Bloqueio de venda"
                htmlFor="prod-block-stock"
                className="sm:col-span-2"
              >
                <label className="flex items-center gap-2 text-sm text-foreground">
                  <Checkbox
                    id="prod-block-stock"
                    checked={values.blockSaleWhenOutOfStock}
                    onCheckedChange={(v) =>
                      setField("blockSaleWhenOutOfStock", v === true)
                    }
                  />
                  Bloquear venda quando estoque = 0
                </label>
              </FormField>
            </FormGrid>
          </FormSection>
        ) : null}

        {activeTab === "fiscal" ? (
          <FormSection
            title="Dados fiscais para NF-e"
            description="Campos usados na emissão. Digite o NCM livremente (8 dígitos)."
          >
            <FormGrid cols={2}>
              <FormField
                label="NCM"
                htmlFor="prod-ncm"
                error={fieldError("ncm")}
                hint="8 dígitos. Digite o código livremente."
              >
                <Input
                  id="prod-ncm"
                  placeholder="27101932"
                  value={values.ncm}
                  onChange={(e) => {
                    setField("ncm", e.target.value);
                    if (values.ncmId) setField("ncmId", "");
                  }}
                  inputMode="numeric"
                  maxLength={10}
                />
              </FormField>

              <FormField label="Exceção NCM" htmlFor="prod-ncm-exc">
                <Input
                  id="prod-ncm-exc"
                  value={values.ncmException}
                  onChange={(e) => setField("ncmException", e.target.value)}
                />
              </FormField>

              <FormField
                label="Origem da mercadoria"
                htmlFor="prod-nfe-origin"
                error={fieldError("nfeOrigin")}
                hint="0 = Nacional. Obrigatório para NF-e."
              >
                <Input
                  id="prod-nfe-origin"
                  type="number"
                  min="0"
                  max="8"
                  step="1"
                  value={values.nfeOrigin}
                  onChange={(e) => setField("nfeOrigin", e.target.value)}
                />
              </FormField>

              <FormField
                label="Unidade fiscal"
                htmlFor="prod-fiscal-unit"
                hint="Ex.: UN, CX, KG. Obrigatório para NF-e."
              >
                <AppSelect
                  id="prod-fiscal-unit"
                  value={values.fiscalUnit}
                  onValueChange={(v) => setField("fiscalUnit", v)}
                  options={[
                    ...PURCHASE_UNITS.map((u) => ({
                      value: u.value,
                      label: u.label,
                    })),
                    ...(!PURCHASE_UNITS.some(
                      (u) => u.value === values.fiscalUnit,
                    ) && values.fiscalUnit
                      ? [
                          {
                            value: values.fiscalUnit,
                            label: values.fiscalUnit,
                          },
                        ]
                      : []),
                  ]}
                />
              </FormField>

              <FormField
                label="CFOP padrão de saída"
                htmlFor="prod-outbound-op"
              >
                <AppSelect
                  id="prod-outbound-op"
                  value={values.outboundOperationId}
                  onValueChange={(v) => setField("outboundOperationId", v)}
                  emptyLabel="Usar padrão (5102)"
                  placeholder="Usar padrão (5102)"
                  options={outboundOps
                    .filter((o) => o.active)
                    .map((o) => ({
                      value: o.id,
                      label: `${o.cfop} — ${o.description}`,
                    }))}
                />
              </FormField>

              <FormField label="GTIN / EAN" htmlFor="prod-fiscal-gtin">
                <Input
                  id="prod-fiscal-gtin"
                  value={values.fiscalGtin}
                  onChange={(e) => setField("fiscalGtin", e.target.value)}
                />
              </FormField>

              <FormField label="CEST" htmlFor="prod-fiscal-cest">
                <Input
                  id="prod-fiscal-cest"
                  value={values.fiscalCest}
                  onChange={(e) => setField("fiscalCest", e.target.value)}
                />
              </FormField>

              <FormField
                label="Descrição na NF-e"
                htmlFor="prod-fiscal-desc"
                className="sm:col-span-2"
                hint="Se vazio, usa o nome comercial do produto."
              >
                <Input
                  id="prod-fiscal-desc"
                  value={values.fiscalDescription}
                  onChange={(e) =>
                    setField("fiscalDescription", e.target.value)
                  }
                />
              </FormField>

              <FormField
                label="Classificação fiscal"
                htmlFor="prod-fiscal-class"
              >
                <Input
                  id="prod-fiscal-class"
                  value={values.fiscalClass}
                  onChange={(e) => setField("fiscalClass", e.target.value)}
                />
              </FormField>

              <FormField
                label="Classificação PIS/COFINS"
                htmlFor="prod-pis-cofins"
              >
                <Input
                  id="prod-pis-cofins"
                  value={values.pisCofinsClassification}
                  onChange={(e) =>
                    setField("pisCofinsClassification", e.target.value)
                  }
                />
              </FormField>

              <FormField label="CST PIS" htmlFor="prod-cst-pis">
                <Input
                  id="prod-cst-pis"
                  value={values.cstPis}
                  onChange={(e) => setField("cstPis", e.target.value)}
                />
              </FormField>

              <FormField
                label="IPI (%)"
                htmlFor="prod-ipi"
                error={fieldError("ipiPercent")}
              >
                <Input
                  id="prod-ipi"
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={values.ipiPercent}
                  onChange={(e) => setField("ipiPercent", e.target.value)}
                />
              </FormField>

              <FormField
                label="Custo ICMS (%)"
                htmlFor="prod-icms"
                error={fieldError("icmsCostPercent")}
              >
                <Input
                  id="prod-icms"
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={values.icmsCostPercent}
                  onChange={(e) => setField("icmsCostPercent", e.target.value)}
                />
              </FormField>

              <FormField
                label="CBS/IBS"
                htmlFor="prod-cbs-ibs"
                className="sm:col-span-2"
              >
                <Input
                  id="prod-cbs-ibs"
                  value={values.cbsIbsClassification}
                  onChange={(e) =>
                    setField("cbsIbsClassification", e.target.value)
                  }
                />
              </FormField>
            </FormGrid>
            {values.ncm.replace(/\D/g, "").length === 8 &&
            values.nfeOrigin !== "" &&
            values.fiscalUnit ? (
              <p className="mt-3 text-sm text-green-700">Pronto para NF-e</p>
            ) : (
              <p className="mt-3 text-sm text-amber-700">
                Cadastro fiscal incompleto — informe NCM (8 dígitos), origem e
                unidade fiscal.
              </p>
            )}
          </FormSection>
        ) : null}

        {activeTab === "fornecedor" ? (
          <FormSection
            title="Fornecedor do produto"
            description="Selecione quem fornece este item. É obrigatório para salvar."
          >
            {fieldError("supplierId") ? (
              <p className="mb-3 text-sm text-destructive">
                {fieldError("supplierId")}
              </p>
            ) : null}
            <p className="text-sm text-muted-foreground">
              Não encontrou?{" "}
              <Link to="/fornecedores" className="text-primary hover:underline">
                Cadastrar fornecedor
              </Link>
            </p>

            {suppliers.length === 0 ? (
              <p className="mt-4 rounded-xl border border-border bg-card px-4 py-6 text-sm text-muted-foreground">
                Nenhum fornecedor cadastrado.
              </p>
            ) : (
              <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                {suppliers.map((s) => {
                  const selected = s.id === values.supplierId;
                  return (
                    <li key={s.id}>
                      <button
                        type="button"
                        onClick={() => setField("supplierId", s.id)}
                        className={cn(
                          "w-full rounded-xl border p-4 text-left transition-colors",
                          selected
                            ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                            : "border-border bg-card hover:border-primary/30",
                        )}
                      >
                        <p className="font-semibold text-foreground">
                          {s.tradeName}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {s.legalName}
                        </p>
                        <p className="mt-2 text-xs text-muted-foreground">
                          Código: <span className="font-mono">{s.code}</span>
                          {" · "}
                          CNPJ: {formatCnpj(s.cnpj)}
                        </p>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </FormSection>
        ) : null}

        {activeTab === "atributos" && selectedDefs.length > 0 ? (
          <FormSection
            title="Atributos do grupo"
            description="Campos dinâmicos definidos no schema da categoria (ex.: unidade de venda)."
          >
            <DynamicCategoryAttributes
              defs={selectedDefs}
              values={attrs}
              onChange={setAttrs}
            />
          </FormSection>
        ) : null}

        <FormActions className="mt-6">
          <Button type="submit" disabled={pending}>
            {pending
              ? "Salvando…"
              : isEdit
                ? "Salvar alterações"
                : "Criar produto"}
          </Button>
          <Button variant="outline" asChild>
            <Link to="/produtos">Cancelar</Link>
          </Button>
        </FormActions>
      </form>

      {isEdit && productId ? (
        <ProductPromotionsPanel productId={productId} />
      ) : null}

      {isEdit && productId ? (
        <AuditLogPanel
          className="mt-8"
          entityType="Product"
          entityId={productId}
          take={40}
        />
      ) : null}
    </div>
  );
}
