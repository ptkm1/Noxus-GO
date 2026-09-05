import {
  APP_BRAND_NAVY,
  APP_BRAND_PRIMARY,
  PEDIX_PRO_ICON_ASPECT,
  PEDIX_PRO_ICON_PATHS,
  PEDIX_PRO_ICON_VIEWBOX,
} from "@pedidos/shared";
import { StyleSheet, View } from "react-native";
import Svg, { G, Path, Rect } from "react-native-svg";
import { useTheme } from "../../lib/theme";
import { ThemedText } from "../atoms/ThemedText";

/** Escala do P dentro do squircle (onBrand) — padding ~16% por lado. */
const ON_BRAND_LOGO_SCALE = 0.68;
const ON_BRAND_TX = (152 * (1 - ON_BRAND_LOGO_SCALE)) / 2;
const ON_BRAND_TY = (167 * (1 - ON_BRAND_LOGO_SCALE)) / 2;

type IconProps = {
  size?: number;
  onBrand?: boolean;
};

export function CommerceProIcon({ size = 40, onBrand = false }: IconProps) {
  const fill = onBrand ? "#FFFFFF" : APP_BRAND_PRIMARY;
  const width = size;
  const height = size * PEDIX_PRO_ICON_ASPECT;

  return (
    <Svg
      width={width}
      height={height}
      viewBox={PEDIX_PRO_ICON_VIEWBOX}
      fill="none"
    >
      {onBrand ? (
        <>
          <Rect
            x="0"
            y="0"
            width="152"
            height="167"
            rx="28"
            fill={APP_BRAND_PRIMARY}
          />
          <G
            transform={`translate(${ON_BRAND_TX} ${ON_BRAND_TY}) scale(${ON_BRAND_LOGO_SCALE})`}
          >
            {PEDIX_PRO_ICON_PATHS.map((d) => (
              <Path key={d.slice(0, 24)} d={d} fill="#FFFFFF" />
            ))}
          </G>
        </>
      ) : (
        PEDIX_PRO_ICON_PATHS.map((d) => (
          <Path key={d.slice(0, 24)} d={d} fill={fill} />
        ))
      )}
    </Svg>
  );
}

type WordmarkProps = {
  iconSize?: number;
  onDark?: boolean;
  showIcon?: boolean;
};

export function CommerceProWordmark({
  iconSize = 44,
  onDark = false,
  showIcon = true,
}: WordmarkProps) {
  const { isDark } = useTheme();
  const pedixColor = onDark || isDark ? APP_BRAND_PRIMARY : APP_BRAND_NAVY;

  return (
    <View style={styles.row}>
      {showIcon ? <CommerceProIcon size={iconSize} /> : null}
      <View>
        <ThemedText style={[styles.line, { fontSize: iconSize * 0.5, color: pedixColor }]}>
          Pedix
        </ThemedText>
        <ThemedText
          style={[
            styles.line,
            styles.pro,
            { fontSize: iconSize * 0.5, color: APP_BRAND_PRIMARY },
          ]}
        >
          Pro
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  line: { fontWeight: "700", letterSpacing: -0.5 },
  pro: { marginTop: 4 },
});
