import type { SchemaFieldDraft } from "../lib/categorySchemaDraft";
import {
  addOptionToDraft,
  emptySchemaDraft,
  removeOptionFromDraft,
  slugifyKeyFromLabel,
} from "../lib/categorySchemaDraft";
import type { AttributeFieldDef } from "./DynamicCategoryAttributes";

const TYPE_OPTIONS: { value: AttributeFieldDef["type"]; label: string }[] = [
  { value: "text", label: "Texto curto" },
  { value: "textarea", label: "Texto longo" },
  { value: "number", label: "Número" },
  { value: "boolean", label: "Sim / Não" },
  { value: "select", label: "Lista de opções" },
];

type Props = {
  drafts: SchemaFieldDraft[];
  onChange: (next: SchemaFieldDraft[]) => void;
  disabled?: boolean;
};

export function CategorySchemaBuilder({ drafts, onChange, disabled }: Props) {
  function setDrafts(next: SchemaFieldDraft[]) {
    onChange(next);
  }

  function patchDraft(id: string, patch: Partial<SchemaFieldDraft>) {
    setDrafts(drafts.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  }

  function patchDraftOption(fieldId: string, optionId: string, patch: { value?: string; label?: string }) {
    setDrafts(
      drafts.map((d) => {
        if (d.id !== fieldId) return d;
        return {
          ...d,
          options: d.options.map((o) => (o.id === optionId ? { ...o, ...patch } : o)),
        };
      }),
    );
  }

  function removeDraft(id: string) {
    setDrafts(drafts.filter((d) => d.id !== id));
  }

  function addField() {
    setDrafts([...drafts, emptySchemaDraft()]);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-600">
          Defina quais informações extras aparecem ao cadastrar um produto nesta categoria.
        </p>
        <button
          type="button"
          disabled={disabled}
          onClick={() => addField()}
          className="rounded-lg border border-brand-200 bg-brand-50 px-3 py-1.5 text-sm font-medium text-brand-800 hover:bg-brand-100 disabled:opacity-50"
        >
          + Adicionar campo
        </button>
      </div>

      {drafts.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
          Nenhum campo extra ainda. Clique em &quot;Adicionar campo&quot; para começar (ex.: Marca, Peso, Cor…).
        </p>
      ) : null}

      <ul className="space-y-4">
        {drafts.map((d, index) => (
          <li
            key={d.id}
            className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 shadow-sm"
          >
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Campo {index + 1}
              </span>
              <button
                type="button"
                disabled={disabled}
                onClick={() => removeDraft(d.id)}
                className="text-xs font-medium text-red-600 hover:text-red-800 disabled:opacity-50"
              >
                Remover campo
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-600">Nome que o usuário vê *</label>
                <input
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-brand-500 focus:ring-2 disabled:bg-slate-100"
                  placeholder="Ex.: Marca do produto"
                  value={d.label}
                  disabled={disabled}
                  onChange={(e) => patchDraft(d.id, { label: e.target.value })}
                  onBlur={() => {
                    if (!d.key.trim() && d.label.trim()) {
                      patchDraft(d.id, { key: slugifyKeyFromLabel(d.label) });
                    }
                  }}
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-600">
                  Chave interna <span className="font-normal text-slate-400">(opcional)</span>
                </label>
                <input
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs outline-none ring-brand-500 focus:ring-2 disabled:bg-slate-100"
                  placeholder="Gerada automaticamente a partir do nome"
                  value={d.key}
                  disabled={disabled}
                  onChange={(e) =>
                    patchDraft(d.id, {
                      key: e.target.value.toLowerCase().replace(/\s+/g, "_"),
                    })
                  }
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600">Tipo do campo</label>
                <select
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-brand-500 focus:ring-2 disabled:bg-slate-100"
                  value={d.type}
                  disabled={disabled}
                  onChange={(e) =>
                    patchDraft(d.id, {
                      type: e.target.value as AttributeFieldDef["type"],
                    })
                  }
                >
                  {TYPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-end pb-2">
                <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    className="size-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                    checked={d.required}
                    disabled={disabled}
                    onChange={(e) => patchDraft(d.id, { required: e.target.checked })}
                  />
                  Obrigatório
                </label>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600">
                  Grupo na tela <span className="font-normal text-slate-400">(opcional)</span>
                </label>
                <input
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-brand-500 focus:ring-2 disabled:bg-slate-100"
                  placeholder="Ex.: Identidade, Embalagem"
                  value={d.section}
                  disabled={disabled}
                  onChange={(e) => patchDraft(d.id, { section: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600">
                  Dica no campo <span className="font-normal text-slate-400">(opcional)</span>
                </label>
                <input
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-brand-500 focus:ring-2 disabled:bg-slate-100"
                  placeholder="Ex.: 500 ml"
                  value={d.placeholder}
                  disabled={disabled}
                  onChange={(e) => patchDraft(d.id, { placeholder: e.target.value })}
                />
              </div>
            </div>

            {d.type === "number" ? (
              <div className="mt-3 grid gap-3 border-t border-slate-200 pt-3 sm:grid-cols-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600">Mínimo</label>
                  <input
                    type="text"
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-brand-500 focus:ring-2 disabled:bg-slate-100"
                    value={d.minStr}
                    disabled={disabled}
                    onChange={(e) => patchDraft(d.id, { minStr: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600">Máximo</label>
                  <input
                    type="text"
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-brand-500 focus:ring-2 disabled:bg-slate-100"
                    value={d.maxStr}
                    disabled={disabled}
                    onChange={(e) => patchDraft(d.id, { maxStr: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600">Incremento</label>
                  <input
                    type="text"
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-brand-500 focus:ring-2 disabled:bg-slate-100"
                    placeholder="ex.: 0.01"
                    value={d.stepStr}
                    disabled={disabled}
                    onChange={(e) => patchDraft(d.id, { stepStr: e.target.value })}
                  />
                </div>
              </div>
            ) : null}

            {d.type === "select" ? (
              <div className="mt-3 border-t border-slate-200 pt-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-slate-600">Opções da lista</span>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => patchDraft(d.id, addOptionToDraft(d))}
                    className="text-xs font-medium text-brand-700 hover:underline disabled:opacity-50"
                  >
                    + Opção
                  </button>
                </div>
                <ul className="space-y-2">
                  {d.options.map((opt) => (
                    <li key={opt.id} className="flex flex-wrap items-end gap-2 rounded-lg bg-white p-2 ring-1 ring-slate-100">
                      <div className="min-w-[100px] flex-1">
                        <label className="block text-[10px] font-medium uppercase text-slate-500">
                          Código
                        </label>
                        <input
                          className="mt-0.5 w-full rounded border border-slate-200 px-2 py-1 font-mono text-xs outline-none focus:ring-1 focus:ring-brand-400 disabled:bg-slate-50"
                          placeholder="ex.: UN"
                          value={opt.value}
                          disabled={disabled}
                          onChange={(e) =>
                            patchDraftOption(d.id, opt.id, { value: e.target.value })
                          }
                        />
                      </div>
                      <div className="min-w-[140px] flex-[2]">
                        <label className="block text-[10px] font-medium uppercase text-slate-500">
                          Texto exibido
                        </label>
                        <input
                          className="mt-0.5 w-full rounded border border-slate-200 px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-brand-400 disabled:bg-slate-50"
                          placeholder="ex.: Unidade"
                          value={opt.label}
                          disabled={disabled}
                          onChange={(e) =>
                            patchDraftOption(d.id, opt.id, { label: e.target.value })
                          }
                        />
                      </div>
                      <button
                        type="button"
                        disabled={disabled || d.options.length <= 1}
                        onClick={() => patchDraft(d.id, removeOptionFromDraft(d, opt.id))}
                        className="shrink-0 rounded px-2 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-40"
                        title="Remover opção"
                      >
                        ✕
                      </button>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-[11px] text-slate-500">
                  O código é gravado nos dados do produto; o texto é o que aparece nas listas e formulários.
                </p>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
