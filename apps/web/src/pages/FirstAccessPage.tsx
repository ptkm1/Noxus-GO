import { useAuth } from "@/auth/AuthContext";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

/** Onboarding mínimo pós-ativação — redireciona para o painel. */
export function FirstAccessPage() {
  const { user } = useAuth();
  return (
    <div className="mx-auto max-w-lg space-y-4 p-8">
      <h1 className="text-2xl font-semibold">Bem-vindo ao PedixPro</h1>
      <p className="text-muted-foreground">
        Olá{user?.name ? `, ${user.name}` : ""}. Sua conta está ativa. Nos
        próximos passos você pode cadastrar produtos, clientes e convidar
        vendedores.
      </p>
      <div className="flex flex-wrap gap-3">
        <Button asChild>
          <Link to="/">Ir ao painel</Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/produtos">Cadastrar produtos</Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/usuarios">Convidar equipe</Link>
        </Button>
      </div>
    </div>
  );
}
