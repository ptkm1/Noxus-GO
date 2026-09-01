import { cn } from "@/lib/utils";
import type { HomeIndicatorPreviewType } from "@pedidos/shared";

type Props = {
  previewType: HomeIndicatorPreviewType;
  className?: string;
};

function RadialPreview() {
  return (
    <svg
      viewBox="0 0 80 56"
      className="h-full w-full"
      aria-hidden
      role="presentation"
    >
      <path
        d="M12 48 A 28 28 0 0 1 68 48"
        fill="none"
        stroke="currentColor"
        strokeWidth="6"
        className="text-muted/30"
        strokeLinecap="round"
      />
      <path
        d="M12 48 A 28 28 0 0 1 52 22"
        fill="none"
        stroke="#22c55e"
        strokeWidth="6"
        strokeLinecap="round"
      />
      <text
        x="40"
        y="44"
        textAnchor="middle"
        className="fill-foreground text-[11px] font-semibold"
        style={{ fontSize: 11 }}
      >
        72%
      </text>
    </svg>
  );
}

function BarPreview() {
  const bars = [
    { h: 28, color: "#6366f1" },
    { h: 40, color: "#22c55e" },
    { h: 22, color: "#f59e0b" },
    { h: 34, color: "#ec4899" },
    { h: 18, color: "#14b8a6" },
  ];
  return (
    <svg
      viewBox="0 0 80 56"
      className="h-full w-full"
      aria-hidden
      role="presentation"
    >
      {bars.map((bar, i) => {
        const x = 10 + i * 14;
        const y = 48 - bar.h;
        return (
          <rect
            key={i}
            x={x}
            y={y}
            width={10}
            height={bar.h}
            rx={2}
            fill={bar.color}
            opacity={0.9}
          />
        );
      })}
      <line
        x1="6"
        y1="48"
        x2="74"
        y2="48"
        stroke="currentColor"
        strokeWidth="1"
        className="text-border"
      />
    </svg>
  );
}

export function HomeIndicatorPreviewThumb({
  previewType,
  className,
}: Readonly<Props>) {
  return (
    <div
      className={cn(
        "flex h-[72px] w-[88px] shrink-0 items-center justify-center rounded-lg border border-border/70 bg-muted/30 p-2",
        className,
      )}
    >
      {previewType === "radial" ? <RadialPreview /> : <BarPreview />}
    </div>
  );
}
