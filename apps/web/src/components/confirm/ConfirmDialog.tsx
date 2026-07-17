import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { AlertCircle, AlertTriangle, Info } from "lucide-react";
import type { ConfirmTone } from "./types";

type ConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: ConfirmTone;
  mode: "confirm" | "alert";
  onConfirm: () => void;
  onCancel: () => void;
};

const toneStyles: Record<
  ConfirmTone,
  { iconWrap: string; icon: typeof AlertTriangle }
> = {
  default: {
    iconWrap: "bg-primary/10 text-primary",
    icon: Info,
  },
  destructive: {
    iconWrap: "bg-destructive/10 text-destructive",
    icon: AlertTriangle,
  },
  danger: {
    iconWrap: "bg-destructive/10 text-destructive",
    icon: AlertCircle,
  },
};

/**
 * Modal de confirmação / alerta no padrão visual das mensagens
 * importantes do painel (título, descrição, ícone e ações claras).
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancelar",
  tone = "default",
  mode,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const styles = toneStyles[tone];
  const Icon = styles.icon;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="sm:max-w-md">
        <DialogHeader className="sm:text-left">
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
            <div
              className={cn(
                "flex size-12 shrink-0 items-center justify-center rounded-full",
                styles.iconWrap,
              )}
              aria-hidden
            >
              <Icon className="size-6" />
            </div>
            <div className="min-w-0 flex-1 space-y-2 text-center sm:text-left">
              <DialogTitle>{title}</DialogTitle>
              {description ? (
                <DialogDescription className="text-pretty">
                  {description}
                </DialogDescription>
              ) : null}
            </div>
          </div>
        </DialogHeader>
        <DialogFooter className="sm:justify-end">
          {mode === "confirm" ? (
            <Button type="button" variant="outline" onClick={onCancel}>
              {cancelLabel}
            </Button>
          ) : null}
          <Button
            type="button"
            variant={
              tone === "destructive" || tone === "danger"
                ? "destructive"
                : "default"
            }
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
