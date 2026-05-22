import { Link } from "react-router-dom";
import { Zap } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  to?: string;
  className?: string;
  inverted?: boolean;
};

export function AppLogo({ to = "/", className = "", inverted = false }: Props) {
  return (
    <Link
      to={to}
      className={cn(
        "flex shrink-0 items-center gap-2 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
    >
      <div
        className={cn(
          "flex h-9 w-9 items-center justify-center rounded-lg",
          inverted ? "bg-primary" : "bg-primary",
        )}
      >
        <Zap className={cn("h-5 w-5", inverted ? "text-primary-foreground" : "text-primary-foreground")} />
      </div>
      <span
        className={cn(
          "text-lg font-bold tracking-tight",
          inverted ? "text-foreground" : "gradient-text",
        )}
      >
        Pedidos
      </span>
    </Link>
  );
}
