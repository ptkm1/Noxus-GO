import { Button } from "@/components/ui/button";
import type { PublicBoletoInstructions } from "@pedidos/shared";
import { useState } from "react";
import { copyText } from "./copy-text";

type Props = {
  boleto: PublicBoletoInstructions;
  amountBrl: number;
};

export function BoletoChargePanel({ boleto, amountBrl }: Props) {
  const [copied, setCopied] = useState(false);
  const line = boleto.identificationField || boleto.barCode || "";

  async function onCopy() {
    if (!line) return;
    const ok = await copyText(line);
    if (!ok) return;
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Boleto de <strong className="text-foreground">R$ {amountBrl}</strong>. O
        acesso libera quando o pagamento for confirmado (pode levar até 1–3
        dias úteis).
      </p>
      {line ? (
        <div className="space-y-2">
          <p className="break-all rounded-md border border-border bg-muted/40 px-3 py-2 font-mono text-xs text-foreground">
            {line}
          </p>
          <Button type="button" variant="outline" className="w-full" onClick={() => void onCopy()}>
            {copied ? "Linha digitável copiada" : "Copiar linha digitável"}
          </Button>
        </div>
      ) : null}
      <div className="flex flex-col gap-2">
        {boleto.bankSlipUrl ? (
          <Button type="button" className="w-full" asChild>
            <a href={boleto.bankSlipUrl} target="_blank" rel="noreferrer">
              Abrir boleto em PDF
            </a>
          </Button>
        ) : null}
        {boleto.invoiceUrl && boleto.invoiceUrl !== boleto.bankSlipUrl ? (
          <Button type="button" variant="outline" className="w-full" asChild>
            <a href={boleto.invoiceUrl} target="_blank" rel="noreferrer">
              Abrir fatura
            </a>
          </Button>
        ) : null}
      </div>
    </div>
  );
}
