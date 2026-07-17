import { cn } from "@/lib/utils";
import {
  APP_BRAND_LILAC,
  COMMERCE_PRO_ICON_ASPECT,
  COMMERCE_PRO_ICON_PATH,
  COMMERCE_PRO_ICON_VIEWBOX,
} from "@pedidos/shared";

type IconProps = {
  size?: number;
  className?: string;
  /** Ícone branco sobre fundo lilás (estilo app icon). */
  onBrand?: boolean;
};

export function CommerceProIcon({
  size = 36,
  className,
  onBrand = false,
}: IconProps) {
  const fill = onBrand ? "#FFFFFF" : APP_BRAND_LILAC;
  const width = size;
  const height = size * COMMERCE_PRO_ICON_ASPECT;

  return (
    <svg
      width={width}
      height={height}
      viewBox={COMMERCE_PRO_ICON_VIEWBOX}
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
            width="133"
            height="121"
            rx="18"
            fill={APP_BRAND_LILAC}
          />
          <path d={COMMERCE_PRO_ICON_PATH} fill="#FFFFFF" />
        </>
      ) : (
        <path d={COMMERCE_PRO_ICON_PATH} fill={fill} />
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
    fontFamily: "'Space Grotesk', system-ui, sans-serif",
    fontSize: iconSize * 0.55,
  };

  return (
    <div className={cn("flex items-center gap-3", className)}>
      {showIcon ? <CommerceProIcon size={iconSize} /> : null}
      <div className="leading-none">
        <p
          className={cn(
            "font-bold tracking-tight",
            onDark ? "text-primary" : "text-neutral-900 dark:text-primary",
          )}
          style={textStyle}
        >
          commerce
        </p>
        <p
          className="mt-1 font-bold tracking-tight text-primary"
          style={textStyle}
        >
          pro
        </p>
      </div>
    </div>
  );
}
