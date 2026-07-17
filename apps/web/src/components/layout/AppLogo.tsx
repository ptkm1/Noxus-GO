import { CommerceProWordmark } from "@/components/brand/CommerceProBrand";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";

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
        "flex shrink-0 items-center rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
    >
      <CommerceProWordmark onDark={inverted} iconSize={36} />
    </Link>
  );
}
