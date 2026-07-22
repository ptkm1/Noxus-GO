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

export type ChooseOption = {
  id: string;
  label: string;
  tone?: ConfirmTone;
  /** Opção visível mas não selecionável (ex.: visita já em curso). */
  disabled?: boolean;
};

export type ChooseOptions = {
  title: string;
  description?: string;
  options: ChooseOption[];
  cancelLabel?: string;
};

export type ConfirmDialogMode = "confirm" | "alert" | "choose";

export type ConfirmDialogState = {
  mode: ConfirmDialogMode;
  title: string;
  description?: string;
  confirmLabel: string;
  cancelLabel: string;
  tone: ConfirmTone;
  options?: ChooseOption[];
};
