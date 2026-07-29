import { useAuth } from "@/auth/AuthContext";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  getPlanDefinition,
  PLAN_FEATURE_LABELS,
  type PlanFeature,
} from "@pedidos/shared";
import { Lock } from "lucide-react";

function plansUrl(): string {
  const base =
    import.meta.env.VITE_SITE_URL?.trim() || "http://localhost:3001";
  const cleaned = base.replace(/\/$/, "");
  return `${cleaned}/#planos`;
}

export function PlanFeatureGate({ feature }: { feature: PlanFeature }) {
  const { user } = useAuth();
  const plan = getPlanDefinition(user?.subscription?.planId);
  const featureLabel = PLAN_FEATURE_LABELS[feature];

  return (
    <div className="flex min-h-[50vh] items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Lock className="size-5" />
          </div>
          <CardTitle>Recurso não disponível no seu plano</CardTitle>
          <CardDescription>
            <strong className="font-medium text-foreground">{featureLabel}</strong>{" "}
            não está incluso no plano <strong className="font-medium text-foreground">{plan.name}</strong>.
            Faça upgrade para liberar este recurso.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Plano atual: {plan.name}
            {user?.subscription?.status
              ? ` · ${user.subscription.status}`
              : null}
          </p>
        </CardContent>
        <CardFooter>
          <Button asChild>
            <a href={plansUrl()} target="_blank" rel="noreferrer">
              Ver planos / upgrade
            </a>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
