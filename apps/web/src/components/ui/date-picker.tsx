import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar as CalendarIcon } from "lucide-react";
import * as React from "react";

/** Parse `YYYY-MM-DD` as local date (meio-dia) para evitar shift de timezone. */
export function parseIsoDate(iso: string | undefined | null): Date | undefined {
  if (!iso) return undefined;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso.trim());
  if (!m) return undefined;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0, 0);
}

export function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function toIsoMonth(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

type DatePickerProps = {
  id?: string;
  value: string;
  onChange: (isoDate: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  /** `YYYY-MM-DD` máximo selecionável */
  max?: string;
  min?: string;
};

/**
 * Date picker shadcn (Popover + Calendar).
 * `value` / `onChange` no formato ISO `YYYY-MM-DD` (compatível com a API).
 * @see https://ui.shadcn.com/docs/components/date-picker
 */
const MODAL_HOST_SELECTOR =
  '[data-slot="sheet-content"], [data-slot="dialog-content"]';

export function DatePicker({
  id,
  value,
  onChange,
  placeholder = "Selecione a data",
  disabled,
  className,
  max,
  min,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const [portalContainer, setPortalContainer] =
    React.useState<HTMLElement | null>(null);
  const selected = parseIsoDate(value);
  const maxDate = parseIsoDate(max);
  const minDate = parseIsoDate(min);

  return (
    <Popover
      modal
      open={open}
      onOpenChange={(next) => {
        if (next) {
          const host = triggerRef.current?.closest(MODAL_HOST_SELECTOR);
          setPortalContainer(host instanceof HTMLElement ? host : null);
        } else {
          setPortalContainer(null);
        }
        setOpen(next);
      }}
    >
      <PopoverTrigger asChild>
        <Button
          ref={triggerRef}
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          data-empty={!selected}
          className={cn(
            "w-full justify-start text-left font-normal data-[empty=true]:text-muted-foreground",
            className,
          )}
        >
          <CalendarIcon className="size-4 opacity-70" />
          {selected ? (
            format(selected, "dd/MM/yyyy", { locale: ptBR })
          ) : (
            <span>{placeholder}</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        container={portalContainer}
        className="pointer-events-auto z-[100] w-auto p-0"
        align="start"
        onWheel={(e) => e.stopPropagation()}
        onTouchMove={(e) => e.stopPropagation()}
      >
        <Calendar
          mode="single"
          locale={ptBR}
          selected={selected}
          defaultMonth={selected}
          disabled={[
            ...(maxDate ? [{ after: maxDate }] : []),
            ...(minDate ? [{ before: minDate }] : []),
          ]}
          onSelect={(date) => {
            if (!date) {
              onChange("");
              return;
            }
            onChange(toIsoDate(date));
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

type MonthPickerProps = {
  id?: string;
  /** `YYYY-MM` ou `YYYY-MM-DD` */
  value: string;
  onChange: (isoMonthDay: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
};

/** Seletor de competência (mês/ano); devolve sempre `YYYY-MM-01`. */
export function MonthPicker({
  id,
  value,
  onChange,
  placeholder = "Selecione o mês",
  disabled,
  className,
}: MonthPickerProps) {
  const [open, setOpen] = React.useState(false);
  const selected = parseIsoDate(
    value.length === 7 ? `${value}-01` : value || undefined,
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          data-empty={!selected}
          className={cn(
            "w-full justify-start text-left font-normal data-[empty=true]:text-muted-foreground",
            className,
          )}
        >
          <CalendarIcon className="size-4 opacity-70" />
          {selected ? (
            format(selected, "MMMM yyyy", { locale: ptBR })
          ) : (
            <span>{placeholder}</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          locale={ptBR}
          captionLayout="dropdown"
          selected={selected}
          defaultMonth={selected}
          onSelect={(date) => {
            if (!date) {
              onChange("");
              return;
            }
            onChange(`${toIsoMonth(date)}-01`);
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

type DateTimePickerProps = {
  id?: string;
  /** `YYYY-MM-DDTHH:mm` (formato datetime-local) */
  value: string;
  onChange: (dateTimeLocal: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
};

/**
 * Data + hora (substitui `input type="datetime-local"`).
 * Mantém o mesmo formato string usado antes.
 */
export function DateTimePicker({
  id,
  value,
  onChange,
  placeholder = "Selecione data e hora",
  disabled,
  className,
}: DateTimePickerProps) {
  const datePart = value.includes("T")
    ? value.slice(0, 10)
    : value.slice(0, 10);
  const timePart = value.includes("T") ? value.slice(11, 16) : "00:00";
  const selected = parseIsoDate(datePart);

  function emit(nextDate: string, nextTime: string) {
    if (!nextDate) {
      onChange("");
      return;
    }
    onChange(`${nextDate}T${nextTime || "00:00"}`);
  }

  return (
    <div
      className={cn(
        "flex flex-col gap-2 sm:flex-row sm:items-center",
        className,
      )}
    >
      <DatePicker
        id={id}
        value={datePart && datePart.length === 10 ? datePart : ""}
        onChange={(iso) => emit(iso, timePart || "00:00")}
        placeholder={placeholder}
        disabled={disabled}
        className="sm:flex-1"
      />
      <Input
        type="time"
        disabled={disabled || !selected}
        value={selected ? timePart || "00:00" : ""}
        onChange={(e) =>
          emit(
            datePart && datePart.length === 10
              ? datePart
              : toIsoDate(new Date()),
            e.target.value,
          )
        }
        className="w-full sm:w-[8.5rem]"
        aria-label="Horário"
      />
    </div>
  );
}
