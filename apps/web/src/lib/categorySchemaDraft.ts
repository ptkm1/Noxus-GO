import type { AttributeFieldDef } from "../components/DynamicCategoryAttributes";

export type SchemaFieldDraft = {
  id: string;
  key: string;
  label: string;
  type: AttributeFieldDef["type"];
  required: boolean;
  section: string;
  placeholder: string;
  options: { id: string; value: string; label: string }[];
  minStr: string;
  maxStr: string;
  stepStr: string;
};

function newId(): string {
  return crypto.randomUUID();
}

/** Gera chave snake_case válida para a API a partir do nome amigável. */
export function slugifyKeyFromLabel(label: string): string {
  const base = label
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_");

  let k = base.replace(/^[^a-z]+/, "");
  if (!k.length) k = "campo";
  if (!/^[a-z]/.test(k)) k = `x_${k}`;
  return k.slice(0, 64);
}

export function emptySchemaDraft(): SchemaFieldDraft {
  return {
    id: newId(),
    key: "",
    label: "",
    type: "text",
    required: false,
    section: "",
    placeholder: "",
    options: [{ id: newId(), value: "", label: "" }],
    minStr: "",
    maxStr: "",
    stepStr: "",
  };
}

export function parseSchemaToDrafts(raw: unknown): SchemaFieldDraft[] {
  if (!Array.isArray(raw)) return [];
  const out: SchemaFieldDraft[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const type = o.type;
    if (
      type !== "text" &&
      type !== "textarea" &&
      type !== "number" &&
      type !== "boolean" &&
      type !== "select"
    ) {
      continue;
    }
    const optsRaw = Array.isArray(o.options) ? o.options : [];
    const options = optsRaw.map((op) => {
      if (!op || typeof op !== "object") return { id: newId(), value: "", label: "" };
      const p = op as Record<string, unknown>;
      return {
        id: newId(),
        value: typeof p.value === "string" ? p.value : String(p.value ?? ""),
        label: typeof p.label === "string" ? p.label : String(p.label ?? ""),
      };
    });
    out.push({
      id: newId(),
      key: typeof o.key === "string" ? o.key : "",
      label: typeof o.label === "string" ? o.label : "",
      type,
      required: o.required === true,
      section: typeof o.section === "string" ? o.section : "",
      placeholder: typeof o.placeholder === "string" ? o.placeholder : "",
      options: options.length ? options : [{ id: newId(), value: "", label: "" }],
      minStr: typeof o.min === "number" ? String(o.min) : "",
      maxStr: typeof o.max === "number" ? String(o.max) : "",
      stepStr: typeof o.step === "number" ? String(o.step) : "",
    });
  }
  return out;
}

export function buildSchemaFromDrafts(
  drafts: SchemaFieldDraft[],
): { ok: true; schema: AttributeFieldDef[] } | { ok: false; message: string } {
  const schema: AttributeFieldDef[] = [];
  const seenKeys = new Set<string>();

  for (let i = 0; i < drafts.length; i++) {
    const d = drafts[i];
    const label = d.label.trim();
    let key = d.key.trim().toLowerCase().replace(/\s+/g, "_");

    if (!label && !key) continue;

    if (!label) {
      return { ok: false, message: `Campo ${i + 1}: informe o nome do campo (rótulo).` };
    }

    if (!key) key = slugifyKeyFromLabel(label);

    if (!/^[a-z][a-z0-9_]*$/.test(key)) {
      return {
        ok: false,
        message: `Campo “${label}”: chave interna inválida. Use apenas letras minúsculas, números e _ (começando com letra). Você pode deixar em branco para gerar automaticamente.`,
      };
    }

    if (seenKeys.has(key)) {
      return { ok: false, message: `Chave repetida: “${key}”. Ajuste a chave ou o nome dos campos.` };
    }
    seenKeys.add(key);

    const def: AttributeFieldDef = {
      key,
      label,
      type: d.type,
      ...(d.required ? { required: true } : {}),
      ...(d.section.trim() ? { section: d.section.trim() } : {}),
      ...(d.placeholder.trim() ? { placeholder: d.placeholder.trim() } : {}),
    };

    if (d.type === "select") {
      const opts = d.options
        .map((o) => ({
          value: o.value.trim(),
          label: o.label.trim(),
        }))
        .filter((o) => o.value.length > 0 && o.label.length > 0);

      if (opts.length === 0) {
        return {
          ok: false,
          message: `Campo “${label}”: liste pelo menos uma opção com código e texto.`,
        };
      }
      def.options = opts;
    }

    if (d.type === "number") {
      const min = d.minStr.trim() === "" ? undefined : Number(d.minStr.replace(",", "."));
      const max = d.maxStr.trim() === "" ? undefined : Number(d.maxStr.replace(",", "."));
      const step = d.stepStr.trim() === "" ? undefined : Number(d.stepStr.replace(",", "."));
      if (min !== undefined && Number.isNaN(min))
        return { ok: false, message: `Campo “${label}”: valor mínimo inválido.` };
      if (max !== undefined && Number.isNaN(max))
        return { ok: false, message: `Campo “${label}”: valor máximo inválido.` };
      if (step !== undefined && Number.isNaN(step))
        return { ok: false, message: `Campo “${label}”: incremento inválido.` };
      if (min !== undefined) def.min = min;
      if (max !== undefined) def.max = max;
      if (step !== undefined) def.step = step;
    }

    schema.push(def);
  }

  if (schema.length > 48) {
    return { ok: false, message: "No máximo 48 campos por categoria." };
  }

  return { ok: true, schema };
}

export function addOptionToDraft(draft: SchemaFieldDraft): SchemaFieldDraft {
  return {
    ...draft,
    options: [...draft.options, { id: newId(), value: "", label: "" }],
  };
}

export function removeOptionFromDraft(draft: SchemaFieldDraft, optionId: string): SchemaFieldDraft {
  const next = draft.options.filter((o) => o.id !== optionId);
  return {
    ...draft,
    options: next.length ? next : [{ id: newId(), value: "", label: "" }],
  };
}
