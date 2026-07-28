import {
  APP_BRAND_NAME,
  APP_BRAND_PRIMARY,
  PEDIX_PRO_ICON_PATHS,
  PEDIX_PRO_ICON_VIEWBOX,
} from "@pedidos/shared";

export function BrandMark({
  size = 36,
  color = APP_BRAND_PRIMARY,
}: {
  size?: number;
  color?: string;
}) {
  return (
    <svg
      width={size}
      height={Math.round(size * (167 / 152))}
      viewBox={PEDIX_PRO_ICON_VIEWBOX}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={APP_BRAND_NAME}
    >
      {PEDIX_PRO_ICON_PATHS.map((d) => (
        <path key={d.slice(0, 24)} d={d} fill={color} />
      ))}
    </svg>
  );
}
