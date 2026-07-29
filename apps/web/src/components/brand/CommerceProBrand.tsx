import { cn } from "@/lib/utils";
import {
  APP_BRAND_PRIMARY,
  PEDIX_PRO_ICON_ASPECT,
  PEDIX_PRO_ICON_PATHS,
  PEDIX_PRO_ICON_VIEWBOX,
} from "@pedidos/shared";

type IconProps = {
  size?: number;
  className?: string;
  /** Ícone branco sobre fundo teal (estilo app icon). */
  onBrand?: boolean;
};

export function CommerceProIcon({
  size = 36,
  className,
  onBrand = false,
}: IconProps) {
  const fill = onBrand ? "#FFFFFF" : APP_BRAND_PRIMARY;
  const width = size;
  const height = size * PEDIX_PRO_ICON_ASPECT;

  return (
    <svg
      width={width}
      height={height}
      viewBox={PEDIX_PRO_ICON_VIEWBOX}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0", className)}
      aria-hidden
    >
      {onBrand ? (
        <>
          <rect
            x="0"
            y="0"
            width="152"
            height="167"
            rx="28"
            fill={APP_BRAND_PRIMARY}
          />
          {PEDIX_PRO_ICON_PATHS.map((d) => (
            <path key={d.slice(0, 24)} d={d} fill="#FFFFFF" />
          ))}
        </>
      ) : (
        PEDIX_PRO_ICON_PATHS.map((d) => (
          <path key={d.slice(0, 24)} d={d} fill={fill} />
        ))
      )}
    </svg>
  );
}

type WordmarkProps = {
  className?: string;
  iconSize?: number;
  /** Fundo escuro (ex.: hero do login). */
  onDark?: boolean;
  showIcon?: boolean;
};

export function CommerceProWordmark({
  className,
  iconSize = 40,
  onDark = false,
  showIcon = true,
}: WordmarkProps) {
  const textStyle = {
    fontFamily: "'Sora', system-ui, sans-serif",
    fontSize: iconSize * 0.55,
  };

  return (
    <div className={cn("flex items-center gap-3", className)}>
      {showIcon ? <CommerceProIcon size={iconSize} /> : null}
      <div className="leading-none">
        <p
          className={cn(
            "font-bold tracking-tight",
            onDark ? "text-primary" : "text-foreground",
          )}
          style={textStyle}
        >
          Pedix
        </p>
        <p
          className="mt-1 font-bold tracking-tight text-primary"
          style={textStyle}
        >
          Pro
        </p>
      </div>
    </div>
  );
}
