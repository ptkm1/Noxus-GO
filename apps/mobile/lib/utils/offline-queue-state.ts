export function offlineQueueStateLabel(state: string): string {
  switch (state) {
    case "queued":
      return "Na fila";
    case "syncing":
      return "A enviar…";
    case "dead":
      return "Erro";
    default:
      return state;
  }
}
