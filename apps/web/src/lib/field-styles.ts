import { cn } from "@/lib/utils";

/** Estilo partilhado entre Input, Select trigger e Textarea. */
export const fieldControlClass = cn(
  "border-input placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground",
  "h-9 w-full min-w-0 rounded-md border bg-input/60 px-3 py-1 text-sm shadow-xs transition-[color,box-shadow] outline-none",
  "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
  "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
  "aria-invalid:border-destructive aria-invalid:ring-destructive/20",
);
