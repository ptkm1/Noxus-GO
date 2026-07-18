import "@tanstack/react-query";

declare module "@tanstack/react-query" {
  interface Register {
    queryMeta: {
      silentError?: boolean;
    };
    mutationMeta: {
      silentError?: boolean;
      inlineError?: boolean;
    };
  }
}
