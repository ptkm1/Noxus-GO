import { Fragment } from "react";
import { FormField, FormGrid } from "@/components/forms";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { fieldControlClass } from "@/lib/field-styles";

export type AttributeFieldDef = {
  key: string;
  label: string;
  type: "text" | "textarea" | "number" | "boolean" | "select";
  required?: boolean;
  placeholder?: string;
  section?: string;
  options?: { value: string; label: string }[];
  min?: number;
  max?: number;
  step?: number;
};

type Props = {
  defs: AttributeFieldDef[];
  values: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
};

export function DynamicCategoryAttributes({ defs, values, onChange }: Props) {
  if (!defs.length) return null;

  function patch(key: string, v: unknown) {
    const next = { ...values };
    if (v === undefined || v === "") delete next[key];
    else next[key] = v;
    onChange(next);
  }

  let prevSectionMarker = "";
  return (
    <div className="space-y-4 rounded-xl border border-dashed border-primary200 bg-primary/10/40 p-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground">Campos da categoria</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Definidos pelo administrador para esta categoria (especificações por tipo de produto).
        </p>
      </div>

      <FormGrid cols={2}>
      {defs.map((def) => {
        const showSection = Boolean(def.section && def.section !== prevSectionMarker);
        if (def.section) prevSectionMarker = def.section;

        const sectionHead = showSection ? (
          <p
            key={`section-${def.key}`}
            className="border-t border-primary100 pt-3 text-xs font-bold uppercase tracking-wide text-muted-foreground first:border-0 first:pt-0 sm:col-span-2"
          >
            {def.section}
          </p>
        ) : null;

        const rawVal = values[def.key];
        const fieldId = `attr-${def.key}`;
        const spanClass =
          def.type === "textarea" ? "sm:col-span-2" : def.type === "boolean" ? "" : "";

        const control =
          def.type === "text" ? (
            <Input
              id={fieldId}
              placeholder={def.placeholder}
              value={rawVal != null ? String(rawVal) : ""}
              onChange={(e) => patch(def.key, e.target.value)}
            />
          ) : def.type === "textarea" ? (
            <Textarea
              id={fieldId}
              rows={3}
              placeholder={def.placeholder}
              value={rawVal != null ? String(rawVal) : ""}
              onChange={(e) => patch(def.key, e.target.value)}
            />
          ) : def.type === "number" ? (
            <Input
              id={fieldId}
              type="number"
              step={def.step ?? "any"}
              min={def.min}
              max={def.max}
              placeholder={def.placeholder}
              value={rawVal != null && rawVal !== "" ? String(rawVal) : ""}
              onChange={(e) => {
                const t = e.target.value;
                patch(def.key, t === "" ? undefined : Number(t.replace(",", ".")));
              }}
            />
          ) : def.type === "boolean" ? (
            <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                className="size-4 rounded border-border text-primary focus-visible:ring-ring"
                checked={rawVal === true || rawVal === "true"}
                onChange={(e) => patch(def.key, e.target.checked)}
              />
              Sim
            </label>
          ) : def.type === "select" ? (
            <select
              id={fieldId}
              className={fieldControlClass}
              value={rawVal != null ? String(rawVal) : ""}
              onChange={(e) => patch(def.key, e.target.value || undefined)}
            >
              <option value="">{def.required ? "Selecione…" : "(opcional)"}</option>
              {(def.options ?? []).map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          ) : null;

        return (
          <Fragment key={def.key}>
            {sectionHead}
            <FormField
              label={def.label}
              htmlFor={def.type !== "boolean" ? fieldId : undefined}
              required={def.required}
              className={spanClass}
            >
              {control}
            </FormField>
          </Fragment>
        );
      })}
      </FormGrid>
    </div>
  );
}
