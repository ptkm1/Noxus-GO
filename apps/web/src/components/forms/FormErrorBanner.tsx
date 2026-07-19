import { cn } from "@/lib/utils";

type Props = {
  message?: string | null;
  className?: string;
};

/** Banner de erro de formulário (`data-form-error`) para scroll automático. */
export function FormErrorBanner({ message, className }: Props) {
  if (!message) return null;
  return (
    <p
      data-form-error
      role="alert"
      className={cn(
        "rounded-lg bg-red-50 px-3 py-2 text-sm text-destructive dark:bg-red-950/40",
        className,
      )}
    >
      {message}
    </p>
  );
}
