import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { SubscriptionPayMethod } from "@pedidos/shared";
import { Barcode, CreditCard, QrCode } from "lucide-react";

const METHODS: {
  id: SubscriptionPayMethod;
  label: string;
  icon: typeof CreditCard;
}[] = [
  { id: "CREDIT_CARD", label: "Cartão", icon: CreditCard },
  { id: "PIX", label: "Pix", icon: QrCode },
  { id: "BOLETO", label: "Boleto", icon: Barcode },
];

type Props = {
  value: SubscriptionPayMethod;
  onChange: (method: SubscriptionPayMethod) => void;
  disabled?: boolean;
};

export function BillingMethodTabs({ value, onChange, disabled }: Props) {
  return (
    <div
      className="grid grid-cols-3 gap-2"
      role="tablist"
      aria-label="Forma de pagamento"
    >
      {METHODS.map((m) => {
        const Icon = m.icon;
        const selected = value === m.id;
        return (
          <Button
            key={m.id}
            type="button"
            role="tab"
            aria-selected={selected}
            variant={selected ? "default" : "outline"}
            className={cn("h-11", selected && "shadow-sm")}
            disabled={disabled}
            onClick={() => onChange(m.id)}
          >
            <Icon className="size-4" aria-hidden />
            {m.label}
          </Button>
        );
      })}
    </div>
  );
}
