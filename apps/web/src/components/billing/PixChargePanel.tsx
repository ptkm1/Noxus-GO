import { Button } from "@/components/ui/button";
import type { PublicPixInstructions } from "@pedidos/shared";
import { useState } from "react";
import { copyText } from "./copy-text";

type Props = {
  pix: PublicPixInstructions;
  amountBrl: number;
};

export function PixChargePanel({ pix, amountBrl }: Props) {
  const [copied, setCopied] = useState(false);
  const src = pix.encodedImage
    ? pix.encodedImage.startsWith("data:")
      ? pix.encodedImage
      : `data:image/png;base64,${pix.encodedImage}`
    : "";

  async function onCopy() {
    if (!pix.payload) return;
    const ok = await copyText(pix.payload);
    if (!ok) return;
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-4 text-center">
      <p className="text-sm text-muted-foreground">
        Pague <strong className="text-foreground">R$ {amountBrl}</strong> com Pix
        para ativar a assinatura. Esta página confirma sozinha após o
        pagamento.
      </p>
      {src ? (
        <img
          src={src}
          alt="QR Code Pix"
          className="mx-auto size-52 rounded-lg border border-border bg-white p-2"
        />
      ) : null}
      {pix.payload ? (
        <div className="space-y-2">
          <p className="break-all rounded-md border border-border bg-muted/40 px-3 py-2 text-left font-mono text-xs text-foreground">
            {pix.payload}
          </p>
          <Button type="button" variant="outline" className="w-full" onClick={() => void onCopy()}>
            {copied ? "Código copiado" : "Copiar código Pix"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
