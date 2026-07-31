import { APP_BRAND_PRIMARY } from "@pedidos/shared";
import { useEffect, useState, type ReactNode } from "react";
import { ActivityIndicator, View } from "react-native";
import { bootstrapApiBaseOverride } from "../lib/devtools/api-base-override";

type Props = {
  children: ReactNode;
};

/** Loads persisted API base override before the app issues network calls. */
export function DevToolsBootstrap({ children }: Props) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!__DEV__) {
      setReady(true);
      return;
    }
    void bootstrapApiBaseOverride().finally(() => setReady(true));
  }, []);

  if (!ready) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#f8fafc",
        }}
      >
        <ActivityIndicator color={APP_BRAND_PRIMARY} />
      </View>
    );
  }

  return <>{children}</>;
}
