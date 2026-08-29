import type { LucideIcon } from "lucide-react";
import { ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

export type SettingsShortcutItem = {
  to: string;
  title: string;
  description: string;
  icon: LucideIcon;
  onClick?: () => void;
};

export function SettingsShortcutList({
  items,
}: {
  items: SettingsShortcutItem[];
}) {
  const nav = useNavigate();

  if (items.length === 0) return null;

  return (
    <div className="divide-y divide-border rounded-xl border border-border bg-card">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <button
            key={item.to + item.title}
            type="button"
            className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-muted/50"
            onClick={() => {
              if (item.onClick) {
                item.onClick();
                return;
              }
              nav(item.to);
            }}
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Icon className="size-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-medium text-foreground">
                {item.title}
              </span>
              <span className="block text-sm text-muted-foreground">
                {item.description}
              </span>
            </span>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
          </button>
        );
      })}
    </div>
  );
}
