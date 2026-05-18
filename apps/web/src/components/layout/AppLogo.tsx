import { Link } from "react-router-dom";

type Props = {
  /** Destino ao clicar na marca (painel ou login). */
  to?: string;
  className?: string;
  /** Texto claro para fundos escuros (login/cadastro). */
  inverted?: boolean;
};

export function AppLogo({ to = "/", className = "", inverted = false }: Props) {
  return (
    <Link
      to={to}
      className={`flex shrink-0 items-center gap-2 rounded-lg outline-none ring-brand-500 focus-visible:ring-2 ${className}`}
    >
      <img src="/favicon.svg" alt="" width={36} height={34} className="size-9 shrink-0" />
      <span
        className={`text-lg font-semibold tracking-tight ${inverted ? "text-white" : "text-brand-700"}`}
      >
        Pedidos
      </span>
    </Link>
  );
}
