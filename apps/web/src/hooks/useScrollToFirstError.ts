import {
  scheduleScrollToFormError,
  type ScrollToFormErrorOptions,
} from "@/lib/scroll-to-form-error";
import { useEffect, useRef } from "react";
import type { RefObject } from "react";

type ErrorSource =
  | Record<string, unknown>
  | string
  | null
  | undefined
  | boolean;

function hasFormErrors(source: ErrorSource): boolean {
  if (source == null || source === false) return false;
  if (source === true) return true;
  if (typeof source === "string") return source.trim().length > 0;
  return Object.values(source).some(
    (v) => typeof v === "string" && v.trim().length > 0,
  );
}

function serializeErrors(source: ErrorSource): string {
  if (source == null || source === false) return "";
  if (source === true) return "true";
  if (typeof source === "string") return source;
  return Object.entries(source)
    .filter(([, v]) => typeof v === "string" && v.trim().length > 0)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}:${v}`)
    .join("|");
}

type Options = ScrollToFormErrorOptions & {
  /** Quando false, não rola. Default: true se houver erros. */
  enabled?: boolean;
  root?: RefObject<HTMLElement | null> | HTMLElement | null;
};

/**
 * Quando `errors` passa a ter conteúdo (ou muda), rola até o primeiro erro no DOM.
 * Use após `setShowValidation(true)` / `setFieldErrors(...)`.
 */
export function useScrollToFirstError(errors: ErrorSource, options?: Options) {
  const serialized = serializeErrors(errors);
  const lastScrolled = useRef<string | null>(null);
  const enabled = options?.enabled !== false;

  useEffect(() => {
    if (!enabled || !hasFormErrors(errors)) {
      if (!hasFormErrors(errors)) lastScrolled.current = null;
      return;
    }
    if (lastScrolled.current === serialized) return;
    lastScrolled.current = serialized;

    const rootRef = options?.root;
    const root =
      rootRef && typeof rootRef === "object" && "current" in rootRef
        ? rootRef.current
        : (rootRef as HTMLElement | null | undefined);

    scheduleScrollToFormError(root, {
      focus: options?.focus,
      behavior: options?.behavior,
    });
  }, [
    serialized,
    enabled,
    errors,
    options?.root,
    options?.focus,
    options?.behavior,
  ]);
}
