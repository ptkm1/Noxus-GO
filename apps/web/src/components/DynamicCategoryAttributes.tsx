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
    <div className="space-y-4 rounded-xl border border-dashed border-brand-200 bg-brand-50/40 p-4">
      <div>
        <h3 className="text-sm font-semibold text-slate-900">Campos da categoria</h3>
        <p className="mt-0.5 text-xs text-slate-600">
          Definidos pelo administrador para esta categoria (especificações por tipo de produto).
        </p>
      </div>

      {defs.map((def) => {
        const showSection = Boolean(def.section && def.section !== prevSectionMarker);
        if (def.section) prevSectionMarker = def.section;

        const sectionHead = showSection ? (
          <p className="border-t border-brand-100 pt-3 text-xs font-bold uppercase tracking-wide text-slate-500 first:border-0 first:pt-0">
            {def.section}
          </p>
        ) : null;

        const commonLabel = (
          <label className="block text-sm font-medium text-slate-700">
            {def.label}
            {def.required ? <span className="text-red-500"> *</span> : null}
          </label>
        );

        const rawVal = values[def.key];

        const control =
          def.type === "text" ? (
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-brand-500 focus:ring-2"
              placeholder={def.placeholder}
              value={rawVal != null ? String(rawVal) : ""}
              onChange={(e) => patch(def.key, e.target.value)}
            />
          ) : def.type === "textarea" ? (
            <textarea
              rows={3}
              className="mt-1 w-full resize-y rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-brand-500 focus:ring-2"
              placeholder={def.placeholder}
              value={rawVal != null ? String(rawVal) : ""}
              onChange={(e) => patch(def.key, e.target.value)}
            />
          ) : def.type === "number" ? (
            <input
              type="number"
              step={def.step ?? "any"}
              min={def.min}
              max={def.max}
              className="mt-1 w-full max-w-xs rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-brand-500 focus:ring-2"
              placeholder={def.placeholder}
              value={rawVal != null && rawVal !== "" ? String(rawVal) : ""}
              onChange={(e) => {
                const t = e.target.value;
                patch(def.key, t === "" ? undefined : Number(t.replace(",", ".")));
              }}
            />
          ) : def.type === "boolean" ? (
            <label className="mt-2 flex cursor-pointer items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                className="size-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                checked={rawVal === true || rawVal === "true"}
                onChange={(e) => patch(def.key, e.target.checked)}
              />
              Sim
            </label>
          ) : def.type === "select" ? (
            <select
              className="mt-1 w-full max-w-md rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-brand-500 focus:ring-2"
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
          <div key={def.key} className="space-y-1">
            {sectionHead}
            {commonLabel}
            {control}
          </div>
        );
      })}
    </div>
  );
}
