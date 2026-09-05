import { useCallback, useRef } from "react";
import { useRouter } from "expo-router";

const DEFAULT_TAP_COUNT = 10;
const TAP_WINDOW_MS = 2500;

type Options = {
  tapCount?: number;
  route?: "/devtools";
};

/** Opens DevTools after rapid taps (e.g. on the app title on login). */
export function useSecretDevToolsGesture(options: Options = {}) {
  const router = useRouter();
  const tapCount = options.tapCount ?? DEFAULT_TAP_COUNT;
  const route = options.route ?? "/devtools";
  const tapsRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onSecretPress = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    tapsRef.current += 1;
    if (tapsRef.current >= tapCount) {
      tapsRef.current = 0;
      router.push(route);
      return;
    }
    timerRef.current = setTimeout(() => {
      tapsRef.current = 0;
    }, TAP_WINDOW_MS);
  }, [router, route, tapCount]);

  return { onSecretPress };
}
