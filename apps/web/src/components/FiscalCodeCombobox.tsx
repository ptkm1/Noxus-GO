import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { fieldControlClass } from "@/lib/field-styles";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  formatFiscalCodeLabel,
  type FiscalCatalogCodeDto,
  type FiscalCatalogSearchResult,
  type FiscalCatalogType,
} from "@pedidos/shared";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

type Props = Readonly<{
  id?: string;
  type: FiscalCatalogType;
  value: string;
  onValueChange: (code: string, item: FiscalCatalogCodeDto | null) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyLabel?: string;
  disabled?: boolean;
  invalid?: boolean;
  className?: string;
  /** Filtro de contexto (CFOP). */
  context?: string;
  /** Direção CFOP: só entradas ou só saídas. */
  direction?: "INBOUND" | "OUTBOUND";
  /** NCM relacionado (CEST). */
  relatedNcm?: string;
  /** Formata o código na lista (ex.: NCM com máscara). */
  formatCode?: (code: string) => string;
  /** Quando o código legado não está no catálogo. */
  legacyWarning?: string | null;
  allowClear?: boolean;
}>;

function useDebounced(value: string, ms: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(value), ms);
    return () => window.clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

export function FiscalCodeCombobox({
  id,
  type,
  value,
  onValueChange,
  placeholder = "Digite ou selecione…",
  searchPlaceholder = "Código ou descrição…",
  emptyLabel = "Limpar seleção",
  disabled,
  invalid,
  className,
  context,
  direction,
  relatedNcm,
  formatCode,
  legacyWarning,
  allowClear = true,
}: Props) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const debouncedQ = useDebounced(query, 250);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data, isFetching, isError } = useQuery({
    queryKey: [
      "admin",
      "fiscal",
      "catalog",
      type,
      debouncedQ,
      context ?? "",
      direction ?? "",
      relatedNcm ?? "",
    ],
    queryFn: () => {
      const params = new URLSearchParams({
        type,
        limit: "40",
        offset: "0",
      });
      if (debouncedQ.trim()) params.set("q", debouncedQ.trim());
      if (context) params.set("context", context);
      if (direction) params.set("direction", direction);
      if (relatedNcm) params.set("relatedNcm", relatedNcm);
      return apiFetch<FiscalCatalogSearchResult>(
        `/admin/fiscal/catalog?${params}`,
      );
    },
    enabled: open,
    staleTime: 60_000,
  });

  const { data: resolved } = useQuery({
    queryKey: ["admin", "fiscal", "catalog-resolve", type, value],
    queryFn: async () => {
      if (!value.trim()) return null;
      try {
        return await apiFetch<FiscalCatalogCodeDto>(
          `/admin/fiscal/catalog/resolve?type=${encodeURIComponent(type)}&code=${encodeURIComponent(value)}&includeInactive=true`,
        );
      } catch {
        return null;
      }
    },
    enabled: Boolean(value.trim()),
    staleTime: 60_000,
  });

  const displayCode = formatCode ? formatCode(value) : value;
  const displayLabel = resolved
    ? formatFiscalCodeLabel(
        formatCode ? formatCode(resolved.code) : resolved.code,
        resolved.description,
      )
    : value
      ? displayCode
      : "";

  const items = data?.items ?? [];
  const notFound =
    Boolean(value.trim()) && resolved === null && !isFetching && !open;

  useEffect(() => {
    if (open) {
      window.setTimeout(() => inputRef.current?.focus(), 0);
    } else {
      setQuery("");
    }
  }, [open]);

  return (
    <div className={cn("w-full", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            id={id}
            disabled={disabled}
            aria-invalid={invalid || undefined}
            aria-expanded={open}
            aria-controls={listId}
            className={cn(
              fieldControlClass,
              "flex w-full items-center justify-between gap-2 text-left font-normal",
              !displayLabel && "text-muted-foreground",
              invalid && "border-destructive",
            )}
          >
            <span className="min-w-0 flex-1 truncate">
              {displayLabel || placeholder}
            </span>
            <ChevronsUpDown
              className="size-4 shrink-0 opacity-50"
              aria-hidden
            />
          </button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[var(--radix-popover-trigger-width)] p-0"
          align="start"
        >
          <div className="border-b border-border p-2">
            <Input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchPlaceholder}
              className="h-9"
            />
          </div>
          <ul
            id={listId}
            role="listbox"
            className="max-h-60 overflow-y-auto py-1"
          >
            {allowClear ? (
              <li>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-muted-foreground hover:bg-muted"
                  onClick={() => {
                    onValueChange("", null);
                    setOpen(false);
                  }}
                >
                  {emptyLabel}
                </button>
              </li>
            ) : null}
            {isFetching ? (
              <li className="flex items-center gap-2 px-3 py-3 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Buscando…
              </li>
            ) : null}
            {isError ? (
              <li className="px-3 py-3 text-sm text-destructive">
                Não foi possível carregar o catálogo.
              </li>
            ) : null}
            {!isFetching && !isError && items.length === 0 ? (
              <li className="px-3 py-3 text-sm text-muted-foreground">
                {debouncedQ.trim()
                  ? "Nenhum código encontrado para esta pesquisa."
                  : "Nenhuma opção disponível neste catálogo."}
              </li>
            ) : null}
            {items.map((item) => {
              const selected = item.code === value;
              const label = formatFiscalCodeLabel(
                formatCode ? formatCode(item.code) : item.code,
                item.description,
              );
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={selected}
                    className={cn(
                      "flex w-full items-start gap-2 px-3 py-2 text-left text-sm hover:bg-muted",
                      selected && "bg-primary/5",
                    )}
                    onClick={() => {
                      onValueChange(item.code, item);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mt-0.5 size-4 shrink-0",
                        selected ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <span className="min-w-0 flex-1 leading-snug">{label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </PopoverContent>
      </Popover>
      {notFound || legacyWarning ? (
        <p className="mt-1 text-xs text-amber-700">
          {legacyWarning ??
            "Código não encontrado na base fiscal atual. Revise ou selecione uma opção válida."}
        </p>
      ) : null}
      {resolved?.outdated ? (
        <p className="mt-1 text-xs text-amber-700">
          Este código está inativo ou fora de vigência na tabela atual.
        </p>
      ) : null}
    </div>
  );
}
