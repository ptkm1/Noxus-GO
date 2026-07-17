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

export function formatApiIssues(issues?: ApiIssue[]): string | undefined {
  if (!issues?.length) return undefined;
  return issues.map((i) => i.message).join("\n");
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
  };
  const fromIssues = formatApiIssues(body.issues);
  const msg =
    fromIssues ||
    body.error?.trim() ||
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
  return new ApiError(msg, res.status, body.issues);
}
