import type { FastifyReply, FastifyRequest } from "fastify";
import type { ZodError } from "zod";

export type PublicIssue = { code?: string; message: string };

export function issuesFromZod(error: ZodError): PublicIssue[] {
  return error.issues.map((i) => {
    const path = i.path.filter((p) => p !== undefined && p !== "").join(".");
    return {
      code: path || undefined,
      message: i.message,
    };
  });
}

export function formatZodIssues(error: ZodError): string {
  const issues = issuesFromZod(error);
  if (issues.length === 0) return "Dados inválidos";
  return issues
    .map((i) => (i.code ? `${i.code}: ${i.message}` : i.message))
    .join("; ");
}

/** 400 padronizado com campo + motivo (API + logs). */
export function sendZodError(
  reply: FastifyReply,
  error: ZodError,
  req?: FastifyRequest,
  prefix = "Dados inválidos",
) {
  const issues = issuesFromZod(error);
  const summary = formatZodIssues(error);
  req?.log.warn({ issues }, "validação rejeitada");
  return reply.status(400).send({
    error: `${prefix} (${summary})`,
    issues,
  });
}
