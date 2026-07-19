import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type FormGridProps = {
  children: ReactNode;
  className?: string;
  /** 1 col mobile; 2 em sm; 3 em lg por defeito */
  cols?: 1 | 2 | 3 | 4;
};

const colClass: Record<1 | 2 | 3 | 4, string> = {
  1: "grid-cols-1",
  2: "grid-cols-1 sm:grid-cols-2",
  3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
  4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
};

export function FormGrid({ children, className, cols = 2 }: FormGridProps) {
  return (
    <div className={cn("grid gap-4", colClass[cols], className)}>
      {children}
    </div>
  );
}

type FormFieldProps = {
  label: string;
  htmlFor?: string;
  hint?: ReactNode;
  error?: string;
  required?: boolean;
  className?: string;
  children: ReactNode;
};

export function FormField({
  label,
  htmlFor,
  hint,
  error,
  required,
  className,
  children,
}: FormFieldProps) {
  return (
    <div
      className={cn("flex flex-col gap-1.5", className)}
      data-error={error ? "true" : undefined}
    >
      <Label htmlFor={htmlFor} className="text-foreground">
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
      </Label>
      {children}
      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

type FormSectionProps = {
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
};

export function FormSection({
  title,
  description,
  children,
  className,
}: FormSectionProps) {
  return (
    <section className={cn("surface-card space-y-4 p-4 md:p-5", className)}>
      {title ? (
        <div>
          <h2 className="text-base font-semibold text-foreground">{title}</h2>
          {description ? (
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

type FormActionsProps = {
  children: ReactNode;
  className?: string;
};

export function FormActions({ children, className }: FormActionsProps) {
  return (
    <div
      className={cn(
        "flex flex-col-reverse gap-2 border-t border-border/60 pt-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Linha de filtros (datas, selects) em colunas alinhadas. */
export function FilterBar({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "surface-card grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:items-end",
        className,
      )}
    >
      {children}
    </div>
  );
}
