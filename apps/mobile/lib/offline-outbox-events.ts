type L = () => void;

const listeners = new Set<L>();

export function subscribeOfflineOutbox(listener: L): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function notifyOfflineOutboxChanged(): void {
  listeners.forEach((fn) => {
    try {
      fn();
    } catch {
      /* noop */
    }
  });
}
