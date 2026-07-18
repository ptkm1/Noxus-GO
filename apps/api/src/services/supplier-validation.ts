export function normalizeCnpj(raw: string): string {
  return raw.replace(/\D/g, "");
}

export function formatCnpj(digits: string): string {
  const d = normalizeCnpj(digits);
  if (d.length !== 14) return digits;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

function cnpjCheckDigit(digits: string, weights: number[]): number {
  const sum = weights.reduce((acc, w, i) => acc + Number(digits[i]!) * w, 0);
  const mod = sum % 11;
  return mod < 2 ? 0 : 11 - mod;
}

export function isValidCnpj(raw: string): boolean {
  const cnpj = normalizeCnpj(raw);
  if (cnpj.length !== 14) return false;
  if (/^(\d)\1+$/.test(cnpj)) return false;

  const base = cnpj.slice(0, 12);
  const d1 = cnpjCheckDigit(base, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const d2 = cnpjCheckDigit(
    base + String(d1),
    [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2],
  );
  return cnpj === base + String(d1) + String(d2);
}

export function validateSupplierCode(
  raw: string,
): { ok: true; value: string } | { ok: false; error: string } {
  const value = raw.trim();
  if (!value) return { ok: false, error: "Informe o código do fornecedor." };
  if (value.length > 40)
    return { ok: false, error: "Código do fornecedor muito longo (máx. 40)." };
  return { ok: true, value };
}

export function validateSupplierFields(input: {
  code: string;
  legalName: string;
  cnpj: string;
  tradeName: string;
}):
  | {
      ok: true;
      value: {
        code: string;
        legalName: string;
        cnpj: string;
        tradeName: string;
      };
    }
  | { ok: false; error: string } {
  const codeResult = validateSupplierCode(input.code);
  if (!codeResult.ok) return codeResult;

  const legalName = input.legalName.trim();
  if (!legalName) return { ok: false, error: "Informe a razão social." };

  const tradeName = input.tradeName.trim();
  if (!tradeName) return { ok: false, error: "Informe o nome fantasia." };

  const cnpj = normalizeCnpj(input.cnpj);
  if (!isValidCnpj(cnpj)) return { ok: false, error: "CNPJ inválido." };

  return {
    ok: true,
    value: { code: codeResult.value, legalName, cnpj, tradeName },
  };
}
