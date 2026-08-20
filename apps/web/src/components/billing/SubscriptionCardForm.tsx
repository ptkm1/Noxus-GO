import { FormField, FormGrid } from "@/components/forms";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    formatCardExpiryInput,
    formatCardNumberInput,
    normalizeCardNumber,
} from "@pedidos/shared";
import { CreditCard, Lock } from "lucide-react";
import { useState } from "react";
import { apiFetch } from "@/lib/api";

export type SubscriptionCardFormDefaults = {
  holderName?: string;
  holderFullName?: string;
  email?: string;
  cpfCnpj?: string;
  postalCode?: string;
  addressNumber?: string;
  addressComplement?: string;
  mobilePhone?: string;
};

type PayResponse = {
  intentId: string;
  status: "PROCESSING" | "ACTIVE";
  message?: string;
};

type Props = {
  intentId: string;
  planName: string;
  amountBrl: number;
  defaults?: SubscriptionCardFormDefaults;
  skipAuth?: boolean;
  disabled?: boolean;
  onPaid: (result: PayResponse) => void | Promise<void>;
  onError?: (message: string) => void;
};

export function SubscriptionCardForm({
  intentId,
  planName,
  amountBrl,
  defaults,
  skipAuth = false,
  disabled = false,
  onPaid,
  onError,
}: Props) {
  const [holderName, setHolderName] = useState(defaults?.holderName ?? "");
  const [number, setNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [ccv, setCcv] = useState("");
  const [holderFullName, setHolderFullName] = useState(
    defaults?.holderFullName ?? defaults?.holderName ?? "",
  );
  const [email, setEmail] = useState(defaults?.email ?? "");
  const [cpfCnpj, setCpfCnpj] = useState(defaults?.cpfCnpj ?? "");
  const [postalCode, setPostalCode] = useState(defaults?.postalCode ?? "");
  const [addressNumber, setAddressNumber] = useState(
    defaults?.addressNumber ?? "",
  );
  const addressComplement = defaults?.addressComplement ?? "";
  const [mobilePhone, setMobilePhone] = useState(defaults?.mobilePhone ?? "");
  const [pending, setPending] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pending || disabled) return;
    setLocalError(null);
    setPending(true);
    try {
      const result = await apiFetch<PayResponse>(
        `/billing/subscription-intents/${intentId}/pay`,
        {
          method: "POST",
          skipAuth,
          body: JSON.stringify({
            creditCard: {
              holderName,
              number: normalizeCardNumber(number),
              expiry,
              ccv,
            },
            creditCardHolderInfo: {
              name: holderFullName,
              email,
              cpfCnpj,
              postalCode,
              addressNumber,
              addressComplement: addressComplement || null,
              mobilePhone,
            },
          }),
        },
      );
      setNumber("");
      setCcv("");
      await onPaid(result);
    } catch (ex) {
      const msg =
        ex instanceof Error ? ex.message : "Não foi possível processar o pagamento";
      setLocalError(msg);
      onError?.(msg);
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="space-y-4" onSubmit={(e) => void onSubmit(e)}>
      <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
        <Lock className="size-4 shrink-0 text-primary" aria-hidden />
        <span>
          Pagamento seguro · Plano <strong className="text-foreground">{planName}</strong>{" "}
          · R$ {amountBrl}/mês
        </span>
      </div>

      <FormGrid cols={1} className="gap-3">
        <FormField label="Nome no cartão" htmlFor="cc-holder" required>
          <Input
            id="cc-holder"
            autoComplete="cc-name"
            value={holderName}
            onChange={(e) => setHolderName(e.target.value)}
            disabled={pending || disabled}
            required
          />
        </FormField>
        <FormField label="Número do cartão" htmlFor="cc-number" required>
          <div className="relative">
            <CreditCard
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              id="cc-number"
              className="pl-9"
              inputMode="numeric"
              autoComplete="cc-number"
              placeholder="0000 0000 0000 0000"
              value={number}
              onChange={(e) => setNumber(formatCardNumberInput(e.target.value))}
              disabled={pending || disabled}
              required
            />
          </div>
        </FormField>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Validade" htmlFor="cc-exp" required>
            <Input
              id="cc-exp"
              inputMode="numeric"
              autoComplete="cc-exp"
              placeholder="MM/AA"
              value={expiry}
              onChange={(e) => setExpiry(formatCardExpiryInput(e.target.value))}
              disabled={pending || disabled}
              required
            />
          </FormField>
          <FormField label="CVV" htmlFor="cc-cvv" required>
            <Input
              id="cc-cvv"
              inputMode="numeric"
              autoComplete="cc-csc"
              placeholder="123"
              maxLength={4}
              value={ccv}
              onChange={(e) => setCcv(e.target.value.replace(/\D/g, "").slice(0, 4))}
              disabled={pending || disabled}
              required
            />
          </FormField>
        </div>
      </FormGrid>

      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Titular da cobrança
      </p>
      <FormGrid cols={1} className="gap-3">
        <FormField label="Nome completo" htmlFor="bill-name" required>
          <Input
            id="bill-name"
            autoComplete="name"
            value={holderFullName}
            onChange={(e) => setHolderFullName(e.target.value)}
            disabled={pending || disabled}
            required
          />
        </FormField>
        <FormField label="E-mail" htmlFor="bill-email" required>
          <Input
            id="bill-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={pending || disabled}
            required
          />
        </FormField>
        <FormField label="CPF/CNPJ" htmlFor="bill-doc" required>
          <Input
            id="bill-doc"
            inputMode="numeric"
            value={cpfCnpj}
            onChange={(e) => setCpfCnpj(e.target.value)}
            disabled={pending || disabled}
            required
          />
        </FormField>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="CEP" htmlFor="bill-cep" required>
            <Input
              id="bill-cep"
              inputMode="numeric"
              autoComplete="postal-code"
              value={postalCode}
              onChange={(e) => setPostalCode(e.target.value.replace(/\D/g, "").slice(0, 8))}
              disabled={pending || disabled}
              required
            />
          </FormField>
          <FormField label="Número" htmlFor="bill-num" required>
            <Input
              id="bill-num"
              value={addressNumber}
              onChange={(e) => setAddressNumber(e.target.value)}
              disabled={pending || disabled}
              required
            />
          </FormField>
        </div>
        <FormField label="Celular" htmlFor="bill-phone" required>
          <Input
            id="bill-phone"
            type="tel"
            autoComplete="tel"
            value={mobilePhone}
            onChange={(e) => setMobilePhone(e.target.value)}
            disabled={pending || disabled}
            required
          />
        </FormField>
      </FormGrid>

      {localError ? (
        <p className="text-sm text-destructive" role="alert">
          {localError}
        </p>
      ) : null}

      <Button type="submit" className="w-full" disabled={pending || disabled}>
        {pending ? "Processando…" : `Pagar R$ ${amountBrl}/mês`}
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        Seus dados de cartão são enviados com criptografia TLS diretamente ao
        processador de pagamentos. Não armazenamos número completo nem CVV.
      </p>
    </form>
  );
}
