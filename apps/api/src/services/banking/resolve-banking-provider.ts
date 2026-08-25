import type { BankConnection } from "@prisma/client";
import type {
  BankingConnectionConfig,
  BankingProvider,
} from "./banking-provider.js";
import { BankingProviderError } from "./banking-provider.js";
import {
  asMetadataRecord,
  parseEncryptedCredentialsJson,
  readSecretsFromEnvPrefix,
} from "./credentials.js";
import { BancoDoBrasilProvider } from "./providers/bb-provider.js";
import { ItauProvider } from "./providers/itau-provider.js";
import { SantanderProvider } from "./providers/santander-provider.js";

export function resolveBankingEnvironment(
  metadata: Record<string, unknown>,
): "sandbox" | "production" {
  const raw = String(metadata.environment ?? process.env.BANKING_ENVIRONMENT ?? "sandbox")
    .trim()
    .toLowerCase();
  if (raw === "production" || raw === "prod" || raw === "producao") {
    return "production";
  }
  return "sandbox";
}

export function buildBankingConfig(
  connection: Pick<
    BankConnection,
    "provider" | "metadata" | "credentialsEncrypted" | "credentialsEnvPrefix"
  >,
): BankingConnectionConfig {
  const metadata = asMetadataRecord(connection.metadata);
  const fromEnv = readSecretsFromEnvPrefix(connection.credentialsEnvPrefix);
  const fromDb = parseEncryptedCredentialsJson(connection.credentialsEncrypted);
  return {
    provider: connection.provider,
    metadata,
    secrets: { ...fromEnv, ...fromDb },
    environment: resolveBankingEnvironment(metadata),
  };
}

/**
 * Factory única — resto do Pedix não faz switch de banco fora daqui.
 */
export function createBankingProvider(
  connection: Pick<
    BankConnection,
    "provider" | "metadata" | "credentialsEncrypted" | "credentialsEnvPrefix"
  >,
): BankingProvider {
  const config = buildBankingConfig(connection);
  switch (connection.provider) {
    case "ITAU":
      return new ItauProvider(config);
    case "BB":
      return new BancoDoBrasilProvider(config);
    case "SANTANDER":
      return new SantanderProvider(config);
    default: {
      const _exhaustive: never = connection.provider;
      throw new BankingProviderError(
        `Provedor desconhecido: ${_exhaustive}`,
        "UNSUPPORTED",
      );
    }
  }
}
