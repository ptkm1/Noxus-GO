export type ConfirmTone = "default" | "destructive" | "danger";

export type ConfirmOptions = {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** destructive = exclusão; danger = erro/falha; default = confirmação neutra */
  tone?: ConfirmTone;
};

export type AlertOptions = {
  title: string;
  description?: string;
  confirmLabel?: string;
  tone?: ConfirmTone;
};
