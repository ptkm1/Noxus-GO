import { HomeIndicatorPreviewThumb } from "@/components/home/HomeIndicatorPreviewThumb";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  HOME_INDICATOR_SECTION_LABELS,
  HOME_INDICATOR_SECTION_ORDER,
  HOME_INDICATOR_STRATEGY_CATEGORY_LABELS,
  listHomeIndicatorCatalogEntries,
  type HomeIndicatorCatalogEntry,
  type HomeIndicatorKey,
  type HomeIndicatorSection,
  type HomeIndicatorStrategyCategory,
} from "@pedidos/shared";
import { Check, Search, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";

type CategoryFilter = "all" | HomeIndicatorStrategyCategory;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedKeys: HomeIndicatorKey[];
  atCap: boolean;
  disabled?: boolean;
  onAdd: (key: HomeIndicatorKey) => void;
};

function normalizeSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim();
}

function matchesSearch(entry: HomeIndicatorCatalogEntry, query: string): boolean {
  if (!query) return true;
  const haystack = normalizeSearch(
    `${entry.title} ${entry.description} ${HOME_INDICATOR_STRATEGY_CATEGORY_LABELS[entry.strategyCategory]}`,
  );
  return haystack.includes(query);
}

function matchesCategory(
  entry: HomeIndicatorCatalogEntry,
  category: CategoryFilter,
): boolean {
  return category === "all" || entry.strategyCategory === category;
}

function groupBySection(
  entries: HomeIndicatorCatalogEntry[],
): Array<{ section: HomeIndicatorSection; items: HomeIndicatorCatalogEntry[] }> {
  const map = new Map<HomeIndicatorSection, HomeIndicatorCatalogEntry[]>();
  for (const entry of entries) {
    const bucket = map.get(entry.section) ?? [];
    bucket.push(entry);
    map.set(entry.section, bucket);
  }
  return [...map.entries()]
    .sort(
      ([a], [b]) =>
        HOME_INDICATOR_SECTION_ORDER[a] - HOME_INDICATOR_SECTION_ORDER[b],
    )
    .map(([section, items]) => ({ section, items }));
}

function IndicatorCatalogCard({
  entry,
  added,
  atCap,
  disabled,
  onAdd,
}: Readonly<{
  entry: HomeIndicatorCatalogEntry;
  added: boolean;
  atCap: boolean;
  disabled?: boolean;
  onAdd: (key: HomeIndicatorKey) => void;
}>) {
  const categoryLabel =
    HOME_INDICATOR_STRATEGY_CATEGORY_LABELS[entry.strategyCategory];

  return (
    <article className="flex gap-4 rounded-xl border border-border bg-card p-4 shadow-sm">
      <HomeIndicatorPreviewThumb previewType={entry.previewType} />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex items-start gap-1.5">
          <Sparkles
            className="mt-0.5 size-3.5 shrink-0 text-primary/70"
            aria-hidden
          />
          <h3 className="text-sm font-semibold leading-snug text-foreground">
            {entry.title}
          </h3>
        </div>
        <Badge
          variant="outline"
          className="border-primary/30 bg-primary/5 text-primary"
        >
          {categoryLabel}
        </Badge>
        <p className="text-xs leading-relaxed text-muted-foreground">
          {entry.description}
        </p>
        <div className="mt-auto flex justify-end pt-1">
          {added ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled
              className="gap-1.5 border-muted-foreground/30 text-muted-foreground"
            >
              <Check className="size-3.5" aria-hidden />
              Adicionado
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled || atCap}
              className="border-primary text-primary hover:bg-primary/5 hover:text-primary"
              onClick={() => onAdd(entry.key)}
            >
              Adicionar
            </Button>
          )}
        </div>
      </div>
    </article>
  );
}

export function HomeIndicatorCatalogDialog({
  open,
  onOpenChange,
  selectedKeys,
  atCap,
  disabled = false,
  onAdd,
}: Readonly<Props>) {
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [search, setSearch] = useState("");

  const selectedSet = useMemo(() => new Set(selectedKeys), [selectedKeys]);

  const filteredGroups = useMemo(() => {
    const query = normalizeSearch(search);
    const entries = listHomeIndicatorCatalogEntries().filter(
      (entry) => matchesCategory(entry, category) && matchesSearch(entry, query),
    );
    return groupBySection(entries);
  }, [category, search]);

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setSearch("");
      setCategory("all");
    }
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="flex max-h-[90vh] w-[calc(100%-2rem)] max-w-4xl flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl">
        <DialogHeader className="shrink-0 border-b border-border px-6 py-4 text-left">
          <DialogTitle>Adicionar Indicador</DialogTitle>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="shrink-0 space-y-4 border-b border-border px-6 py-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <Tabs
                value={category}
                onValueChange={(value) => setCategory(value as CategoryFilter)}
              >
                <TabsList className="h-auto flex-wrap gap-1 bg-transparent p-0">
                  <TabsTrigger
                    value="all"
                    className={cn(
                      "rounded-full px-4 py-1.5 text-sm data-[state=active]:border-transparent data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-none",
                      "border border-border bg-muted/40 text-muted-foreground",
                    )}
                  >
                    Todos
                  </TabsTrigger>
                  <TabsTrigger
                    value="aquisicao"
                    className={cn(
                      "rounded-full px-4 py-1.5 text-sm data-[state=active]:border-transparent data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-none",
                      "border border-border bg-muted/40 text-muted-foreground",
                    )}
                  >
                    Aquisição
                  </TabsTrigger>
                  <TabsTrigger
                    value="fidelizacao"
                    className={cn(
                      "rounded-full px-4 py-1.5 text-sm data-[state=active]:border-transparent data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-none",
                      "border border-border bg-muted/40 text-muted-foreground",
                    )}
                  >
                    Fidelização
                  </TabsTrigger>
                  <TabsTrigger
                    value="expansao"
                    className={cn(
                      "rounded-full px-4 py-1.5 text-sm data-[state=active]:border-transparent data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-none",
                      "border border-border bg-muted/40 text-muted-foreground",
                    )}
                  >
                    Expansão
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              <div className="relative w-full sm:max-w-xs">
                <Search
                  className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar um indicador"
                  className="pl-9"
                  aria-label="Buscar um indicador"
                />
              </div>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
            <p className="mb-6 text-base font-medium text-foreground">
              Indicadores para todos os momentos da sua estratégia comercial
            </p>

            {filteredGroups.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
                Nenhum indicador encontrado para os filtros selecionados.
              </p>
            ) : (
              <div className="space-y-8">
                {filteredGroups.map(({ section, items }) => (
                  <section key={section}>
                    <h2 className="mb-4 text-xs font-bold tracking-wide text-muted-foreground">
                      {HOME_INDICATOR_SECTION_LABELS[section]}
                    </h2>
                    <div className="grid gap-4 md:grid-cols-2">
                      {items.map((entry) => (
                        <IndicatorCatalogCard
                          key={entry.key}
                          entry={entry}
                          added={selectedSet.has(entry.key)}
                          atCap={atCap}
                          disabled={disabled}
                          onAdd={onAdd}
                        />
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
