import { Link } from "react-router-dom";
import { AppLogo } from "./AppLogo";

type Props = {
  /** Rota atual para alternar link secundário (login ↔ cadastro). */
  variant: "login" | "register";
};

export function PublicSiteHeader({ variant }: Props) {
  const secondary =
    variant === "login" ? (
      <Link
        to="/cadastro"
        className="rounded-lg px-3 py-2 text-sm font-medium text-white/90 underline-offset-4 hover:text-white hover:underline"
      >
        Criar conta
      </Link>
    ) : (
      <Link
        to="/login"
        className="rounded-lg px-3 py-2 text-sm font-medium text-white/90 underline-offset-4 hover:text-white hover:underline"
      >
        Já tenho conta
      </Link>
    );

  return (
    <header className="border-b border-white/10 bg-slate-950/40 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-lg items-center justify-between px-4 sm:max-w-none sm:px-6">
        <AppLogo to="/login" inverted />
        {secondary}
      </div>
    </header>
  );
}
