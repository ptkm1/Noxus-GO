import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { fieldControlClass } from "@/lib/field-styles";
import { cn } from "@/lib/utils";
import { Check, ChevronsUpDown, Package, Search } from "lucide-react";
import { useId, useMemo, useRef, useState } from "react";

export type ProductComboboxItem = {
  id: string;
  name: string;
  sku?: string | null;
  barcode?: string | null;
  imageUrl?: string | null;
  categoryId?: string | null;
  supplierId?: string | null;
};

type Props = Readonly<{
  id?: string;
  value: string;
  onValueChange: (productId: string) => void;
  products: ProductComboboxItem[];
  placeholder?: string;
  /** Placeholder do campo de busca dentro do dropdown. */
  searchPlaceholder?: string;
  /** Mostra opção para limpar a seleção (mapeada para `""`). */
  emptyLabel?: string;
  disabled?: boolean;
  invalid?: boolean;
  className?: string;
}>;

function ProductThumb({
  product,
  size = "md",
}: Readonly<{
  product: Pick<ProductComboboxItem, "name" | "imageUrl">;
  size?: "sm" | "md";
}>) {
  const src = product.imageUrl?.trim();
  const box = size === "sm" ? "size-8" : "size-9";
  const icon = size === "sm" ? "size-3.5" : "size-4";

  if (src) {
    return (
      <img
        src={src}
        alt=""
        className={cn(box, "shrink-0 rounded-md bg-muted object-cover")}
        loading="lazy"
      />
    );
  }

  return (
    <div
      className={cn(
        box,
        "flex shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground",
      )}
      aria-hidden
    >
      <Package className={icon} strokeWidth={1.5} />
    </div>
  );
}

function productCodeHint(product: ProductComboboxItem): string {
  const parts: string[] = [];
  if (product.sku?.trim()) parts.push(`SKU ${product.sku.trim()}`);
  if (product.barcode?.trim()) parts.push(`Cód. ${product.barcode.trim()}`);
  return parts.join(" · ");
}

function ProductOptionLabel({
  product,
}: Readonly<{ product: ProductComboboxItem }>) {
  const code = productCodeHint(product);
  return (
    <div className="min-w-0 flex-1 text-left">
      <p className="truncate text-sm font-medium text-foreground">
        {product.name}
      </p>
      {code ? (
        <p className="truncate text-xs text-muted-foreground">{code}</p>
      ) : (
        <p className="truncate text-xs text-muted-foreground/70">
          Sem código / SKU
        </p>
      )}
    </div>
  );
}

export function matchesProductQuery(
  product: ProductComboboxItem,
  query: string,
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const name = product.name.toLowerCase();
  const sku = (product.sku ?? "").toLowerCase();
  const barcode = (product.barcode ?? "").toLowerCase();
  return name.includes(q) || sku.includes(q) || barcode.includes(q);
}

const MODAL_HOST_SELECTOR =
  '[data-slot="sheet-content"], [data-slot="dialog-content"]';

export function ProductCombobox({
  id,
  value,
  onValueChange,
  products,
  placeholder = "Buscar por nome ou código…",
  searchPlaceholder = "Nome, SKU ou código de barras…",
  emptyLabel,
  disabled,
  invalid,
  className,
}: Props) {
  const listId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  /** Portal into Sheet/Dialog content so RemoveScroll shards + pointer-events apply. */
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(
    null,
  );

  const selected = useMemo(
    () => products.find((p) => p.id === value) ?? null,
    [products, value],
  );

  const filtered = useMemo(
    () => products.filter((p) => matchesProductQuery(p, query)),
    [products, query],
  );

  function select(next: string) {
    onValueChange(next);
    setOpen(false);
    setQuery("");
  }

  return (
    // modal + portal into Sheet/Dialog: body gets pointer-events:none and Dialog
    // RemoveScroll only allows wheel on content shards — portaling to body breaks both.
    <Popover
      modal
      open={open}
      onOpenChange={(next) => {
        if (next) {
          const host = triggerRef.current?.closest(MODAL_HOST_SELECTOR);
          setPortalContainer(host instanceof HTMLElement ? host : null);
        } else {
          setPortalContainer(null);
          setQuery("");
        }
        setOpen(next);
      }}
    >
      <PopoverTrigger asChild>
        <button
          ref={triggerRef}
          type="button"
          id={id}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listId}
          aria-invalid={invalid || undefined}
          disabled={disabled}
          className={cn(
            fieldControlClass,
            "flex h-auto min-h-9 items-center gap-2 py-1.5 text-left",
            !selected && "text-muted-foreground",
            className,
          )}
        >
          {selected ? (
            <>
              <ProductThumb product={selected} size="sm" />
              <ProductOptionLabel product={selected} />
            </>
          ) : (
            <span className="flex-1 truncate">{placeholder}</span>
          )}
          <ChevronsUpDown className="ml-auto size-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        container={portalContainer}
        className="pointer-events-auto z-[100] w-(--radix-popover-trigger-width) min-w-[280px] p-0"
        align="start"
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          searchRef.current?.focus();
        }}
        onWheel={(e) => e.stopPropagation()}
        onTouchMove={(e) => e.stopPropagation()}
      >
        <div className="space-y-1.5 border-b border-border p-2">
          <label
            htmlFor={`${listId}-search`}
            className="px-0.5 text-[11px] font-medium text-muted-foreground"
          >
            Nome ou código do produto
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={searchRef}
              id={`${listId}-search`}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchPlaceholder}
              className="h-8 pl-8"
              aria-label="Buscar por nome, SKU ou código de barras"
              aria-autocomplete="list"
              aria-controls={listId}
            />
          </div>
        </div>
        <div
          id={listId}
          role="listbox"
          aria-label="Produtos"
          className="max-h-64 overflow-y-auto overscroll-contain p-1"
          onWheel={(e) => e.stopPropagation()}
          onTouchMove={(e) => e.stopPropagation()}
        >
          {emptyLabel != null ? (
            <button
              type="button"
              role="option"
              aria-selected={value === ""}
              className={cn(
                "flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm text-muted-foreground",
                "hover:bg-accent hover:text-accent-foreground",
                value === "" && "bg-accent/60",
              )}
              onClick={() => select("")}
            >
              {emptyLabel}
            </button>
          ) : null}
          {filtered.length === 0 ? (
            <p className="px-2 py-6 text-center text-sm text-muted-foreground">
              Nenhum produto encontrado.
            </p>
          ) : (
            filtered.map((product) => {
              const isSelected = product.id === value;
              return (
                <button
                  key={product.id}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left",
                    "hover:bg-accent hover:text-accent-foreground",
                    isSelected && "bg-accent/70",
                  )}
                  onClick={() => select(product.id)}
                >
                  <ProductThumb product={product} />
                  <ProductOptionLabel product={product} />
                  <Check
                    className={cn(
                      "ml-auto size-4 shrink-0 text-primary",
                      isSelected ? "opacity-100" : "opacity-0",
                    )}
                  />
                </button>
              );
            })
          )}
        </div>
        {products.length > 0 ? (
          <div className="border-t border-border px-3 py-1.5">
            <p className="text-[11px] text-muted-foreground">
              {filtered.length} de {products.length} produto
              {products.length === 1 ? "" : "s"}
            </p>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

/** Linha compacta para tabelas (foto + nome + SKU). */
export function ProductListCell({
  product,
}: Readonly<{ product: ProductComboboxItem }>) {
  return (
    <div className="flex items-center gap-2.5">
      <ProductThumb product={product} size="sm" />
      <ProductOptionLabel product={product} />
    </div>
  );
}
