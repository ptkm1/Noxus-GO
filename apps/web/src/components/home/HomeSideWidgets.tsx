import { HomeIndicatorWidget } from "@/components/HomeIndicatorWidget";
import { PositivacaoRadialWidget } from "@/components/home/PositivacaoRadialWidget";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  isHomeChartIndicatorKey,
  type HomeIndicatorKey,
} from "@pedidos/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { GripVertical } from "lucide-react";
import {
  useEffect,
  useState,
  type DragEvent,
} from "react";

type HomeDashboardConfig = {
  homeIndicators: HomeIndicatorKey[];
};

function reorderByIndex<T>(list: T[], from: number, to: number): T[] {
  if (
    from === to ||
    from < 0 ||
    to < 0 ||
    from >= list.length ||
    to >= list.length
  ) {
    return list;
  }
  const next = [...list];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

function SideWidget({
  indicatorKey,
}: Readonly<{ indicatorKey: HomeIndicatorKey }>) {
  if (indicatorKey === "customer_positivacao") {
    return <PositivacaoRadialWidget />;
  }
  if (!isHomeChartIndicatorKey(indicatorKey)) return null;
  return <HomeIndicatorWidget indicatorKey={indicatorKey} compact />;
}

type HomeSideWidgetsProps = {
  indicatorKeys: HomeIndicatorKey[];
};

/**
 * Coluna direita da home — widgets com drag-and-drop.
 * A ordem é persistida em `PATCH /admin/reports/home-dashboard-config`.
 */
export function HomeSideWidgets({
  indicatorKeys,
}: Readonly<HomeSideWidgetsProps>) {
  const qc = useQueryClient();
  const keysSignature = indicatorKeys.join(",");
  const [orderedKeys, setOrderedKeys] = useState(indicatorKeys);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);

  useEffect(() => {
    setOrderedKeys(
      keysSignature
        ? (keysSignature.split(",") as HomeIndicatorKey[])
        : [],
    );
  }, [keysSignature]);

  const persist = useMutation({
    mutationFn: (homeIndicators: HomeIndicatorKey[]) =>
      apiFetch<HomeDashboardConfig>("/admin/reports/home-dashboard-config", {
        method: "PATCH",
        body: JSON.stringify({ homeIndicators }),
      }),
    onSuccess: (data) => {
      qc.setQueryData(["admin", "reports", "home-dashboard-config"], data);
      void qc.invalidateQueries({ queryKey: ["admin", "system-settings"] });
    },
    onError: () => {
      setOrderedKeys(indicatorKeys);
    },
  });

  const onDragStart = (index: number) => (e: DragEvent) => {
    setDragFrom(index);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(index));
  };

  const onDragOver = (index: number) => (e: DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOver !== index) setDragOver(index);
  };

  const onDrop = (index: number) => (e: DragEvent) => {
    e.preventDefault();
    const from =
      dragFrom ?? Number.parseInt(e.dataTransfer.getData("text/plain"), 10);
    setDragFrom(null);
    setDragOver(null);
    if (Number.isNaN(from) || from === index) return;
    const next = reorderByIndex(orderedKeys, from, index);
    if (next === orderedKeys) return;
    setOrderedKeys(next);
    persist.mutate(next);
  };

  const onDragEnd = () => {
    setDragFrom(null);
    setDragOver(null);
  };

  if (orderedKeys.length === 0) return null;

  return (
    <div className="flex flex-col gap-4">
      {orderedKeys.map((key, index) => {
        const isDragging = dragFrom === index;
        const isDropTarget = dragOver === index && dragFrom !== index;
        return (
          <div
            key={key}
            onDragOver={onDragOver(index)}
            onDrop={onDrop(index)}
            onDragLeave={() => {
              if (dragOver === index) setDragOver(null);
            }}
            className={cn(
              "group relative transition-[opacity,box-shadow]",
              isDragging && "opacity-40",
              isDropTarget &&
                "ring-2 ring-primary/40 ring-offset-2 ring-offset-background",
            )}
          >
            <button
              type="button"
              draggable
              onDragStart={onDragStart(index)}
              onDragEnd={onDragEnd}
              aria-label="Arrastar para reordenar widget"
              title="Arrastar para reordenar"
              className={cn(
                "absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-md border border-border/80 bg-card/95 text-muted-foreground shadow-sm",
                "cursor-grab active:cursor-grabbing",
                "opacity-100 md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100",
                "transition-opacity hover:bg-muted hover:text-foreground",
                persist.isPending && "pointer-events-none opacity-50",
              )}
            >
              <GripVertical className="h-4 w-4" aria-hidden />
            </button>
            <SideWidget indicatorKey={key} />
          </div>
        );
      })}
    </div>
  );
}
