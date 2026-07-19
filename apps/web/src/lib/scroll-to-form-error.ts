export type ScrollToFormErrorOptions = {
  /** Preferir focar o primeiro controle inválido após o scroll. Default: true */
  focus?: boolean;
  behavior?: ScrollBehavior;
};

const ERROR_SELECTOR =
  '[data-form-error],[data-error="true"],[aria-invalid="true"]';

function isFocusable(el: Element): el is HTMLElement {
  if (!(el instanceof HTMLElement)) return false;
  if (
    el.hasAttribute("disabled") ||
    el.getAttribute("aria-disabled") === "true"
  ) {
    return false;
  }
  const tag = el.tagName;
  if (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    tag === "BUTTON"
  ) {
    return true;
  }
  if (el.tabIndex >= 0) return true;
  return el.getAttribute("role") === "combobox";
}

/**
 * Rola até o primeiro erro de formulário visível.
 * Prioridade: campo `data-error` → banner `data-form-error` → `aria-invalid`.
 * Funciona em containers com overflow (FormSheet), não só na window.
 */
function resolveErrorScope(root?: ParentNode | null): ParentNode {
  if (root) return root;
  // Prefer the open FormSheet scroll area when it contains an error.
  const sheets = document.querySelectorAll<HTMLElement>(
    "[data-form-sheet-scroll]",
  );
  for (const sheet of sheets) {
    if (sheet.querySelector(ERROR_SELECTOR)) return sheet;
  }
  return document;
}

export function scrollToFormError(
  root?: ParentNode | null,
  options: ScrollToFormErrorOptions = {},
): HTMLElement | null {
  const scope = resolveErrorScope(root);
  const { focus = true, behavior = "smooth" } = options;

  const formBanner = scope.querySelector<HTMLElement>("[data-form-error]");
  const fieldError = scope.querySelector<HTMLElement>('[data-error="true"]');
  const ariaInvalid = scope.querySelector<HTMLElement>('[aria-invalid="true"]');

  // Banner só tem prioridade se não houver campo com erro (ex.: erro só de API).
  const target = fieldError ?? formBanner ?? ariaInvalid;
  if (!target) return null;

  target.scrollIntoView({ behavior, block: "center", inline: "nearest" });

  if (focus) {
    const focusEl =
      (isFocusable(target) ? target : null) ??
      target.querySelector<HTMLElement>(
        'input:not([disabled]):not([type="hidden"]),textarea:not([disabled]),select:not([disabled]),[role="combobox"],button:not([disabled])',
      );
    if (focusEl && isFocusable(focusEl)) {
      window.setTimeout(
        () => {
          try {
            focusEl.focus({ preventScroll: true });
          } catch {
            focusEl.focus();
          }
        },
        behavior === "smooth" ? 280 : 0,
      );
    }
  }

  return target;
}

/** Atalho: espera o paint do React e então rola. */
export function scheduleScrollToFormError(
  root?: ParentNode | null,
  options?: ScrollToFormErrorOptions,
): void {
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      scrollToFormError(root, options);
    });
  });
}

export function firstFormErrorElement(
  root?: ParentNode | null,
): HTMLElement | null {
  const scope = resolveErrorScope(root);
  return scope.querySelector<HTMLElement>(ERROR_SELECTOR);
}
