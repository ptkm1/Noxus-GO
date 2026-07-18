import NetInfo from "@react-native-community/netinfo";
import { useEffect, useState } from "react";
import { Platform } from "react-native";

function fromNetState(s: {
  isConnected: boolean | null;
  isInternetReachable: boolean | null;
}): boolean {
  return Boolean(s.isConnected) && s.isInternetReachable !== false;
}

/** Estado de rede para banners / empty states. No web assume online. */
export function useNetInfoOnline(): boolean {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    if (Platform.OS === "web") {
      setOnline(typeof navigator !== "undefined" ? navigator.onLine : true);
      const on = () => setOnline(true);
      const off = () => setOnline(false);
      window.addEventListener("online", on);
      window.addEventListener("offline", off);
      return () => {
        window.removeEventListener("online", on);
        window.removeEventListener("offline", off);
      };
    }

    void NetInfo.fetch().then((s) => setOnline(fromNetState(s)));
    return NetInfo.addEventListener((s) => setOnline(fromNetState(s)));
  }, []);

  return online;
}
