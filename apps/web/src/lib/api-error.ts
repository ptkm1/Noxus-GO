export type ApiIssue = { code?: string; message: string };

export class ApiError extends Error {
  status?: number;
  issues?: ApiIssue[];

  constructor(message: string, status?: number, issues?: ApiIssue[]) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.issues = issues;
  }
}

function issuesFromDetails(details: unknown): ApiIssue[] {
  if (!details || typeof details !== "object") return [];
  const d = details as {
    fieldErrors?: Record<string, string[] | undefined>;
    formErrors?: string[];
  };
  const out: ApiIssue[] = [];
  if (d.fieldErrors) {
    for (const [field, msgs] of Object.entries(d.fieldErrors)) {
      for (const message of msgs ?? []) {
        out.push({ code: field, message });
      }
    }
  }
  for (const message of d.formErrors ?? []) {
    out.push({ message });
  }
  return out;
}

export function formatApiIssues(issues?: ApiIssue[]): string | undefined {
  if (!issues?.length) return undefined;
  return issues
    .map((i) => (i.code ? `${i.code}: ${i.message}` : i.message))
    .join("\n");
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error && error.message.trim()) return error.message;
  return "Ocorreu um erro inesperado. Tente novamente.";
}

export async function errorFromResponse(res: Response): Promise<ApiError> {
  const payload = await res.json().catch(() => ({}));
  const body = payload as {
    error?: string;
    message?: string;
    issues?: ApiIssue[];
    details?: unknown;
  };
  const issues =
    body.issues?.length ? body.issues : issuesFromDetails(body.details);
  const fromIssues = formatApiIssues(issues);
  const generic = body.error?.trim() === "Dados inválidos";
  const msg =
    fromIssues ||
    (!generic ? body.error?.trim() : undefined) ||
    body.message?.trim() ||
    (res.status === 401
      ? "Sessão expirada. Faça login novamente."
      : res.status === 403
        ? "Você não tem permissão para esta ação."
        : res.status === 404
          ? "Registro não encontrado."
          : res.status >= 500
            ? "Erro no servidor. Tente novamente em instantes."
            : res.statusText || "Não foi possível concluir a operação.");
  if (import.meta.env.DEV) {
    console.warn("[api]", res.status, res.url, body);
  }
  return new ApiError(msg, res.status, issues.length ? issues : undefined);
}
