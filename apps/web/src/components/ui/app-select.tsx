import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

/** Radix Select não aceita `value=""` em SelectItem — usamos sentinela. */
export const SELECT_EMPTY = "__none__";

export type AppSelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

type AppSelectProps = {
  id?: string;
  value: string;
  onValueChange: (value: string) => void;
  options: AppSelectOption[];
  placeholder?: string;
  /** Placeholder como opção selecionável (mapeada para `""`). */
  emptyLabel?: string;
  disabled?: boolean;
  className?: string;
  triggerClassName?: string;
};

export function AppSelect({
  id,
  value,
  onValueChange,
  options,
  placeholder = "Selecione…",
  emptyLabel,
  disabled,
  className,
  triggerClassName,
}: AppSelectProps) {
  const selectValue = value === "" ? SELECT_EMPTY : value;

  return (
    <Select
      value={selectValue}
      disabled={disabled}
      onValueChange={(next) => {
        onValueChange(next === SELECT_EMPTY ? "" : next);
      }}
    >
      <SelectTrigger
        id={id}
        className={cn("w-full", className, triggerClassName)}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {emptyLabel != null ? (
          <SelectItem value={SELECT_EMPTY}>{emptyLabel}</SelectItem>
        ) : null}
        {options.map((opt) => (
          <SelectItem key={opt.value} value={opt.value} disabled={opt.disabled}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
