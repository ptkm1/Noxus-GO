import {
  APP_BRAND_LILAC,
  COMMERCE_PRO_ICON_ASPECT,
  COMMERCE_PRO_ICON_PATH,
  COMMERCE_PRO_ICON_VIEWBOX,
} from "@pedidos/shared";
import { StyleSheet, View } from "react-native";
import Svg, { Path, Rect } from "react-native-svg";
import { useTheme } from "../../lib/theme";
import { ThemedText } from "../atoms/ThemedText";

type IconProps = {
  size?: number;
  onBrand?: boolean;
};

export function CommerceProIcon({ size = 40, onBrand = false }: IconProps) {
  const fill = onBrand ? "#FFFFFF" : APP_BRAND_LILAC;
  const width = size;
  const height = size * COMMERCE_PRO_ICON_ASPECT;

  return (
    <Svg
      width={width}
      height={height}
      viewBox={COMMERCE_PRO_ICON_VIEWBOX}
      fill="none"
    >
      {onBrand ? (
        <>
          <Rect
            x="0"
            y="0"
            width="133"
            height="121"
            rx="18"
            fill={APP_BRAND_LILAC}
          />
          <Path d={COMMERCE_PRO_ICON_PATH} fill="#FFFFFF" />
        </>
      ) : (
        <Path d={COMMERCE_PRO_ICON_PATH} fill={fill} />
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
  const fontSize = iconSize * 0.5;
  const commerceColor = onDark || isDark ? APP_BRAND_LILAC : "#111111";

  return (
    <View style={styles.row}>
      {showIcon ? <CommerceProIcon size={iconSize} /> : null}
      <View>
        <ThemedText style={[styles.line, { fontSize, color: commerceColor }]}>
          commerce
        </ThemedText>
        <ThemedText
          style={[
            styles.line,
            styles.pro,
            { fontSize, color: APP_BRAND_LILAC },
          ]}
        >
          pro
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
