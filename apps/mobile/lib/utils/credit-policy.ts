export function creditPolicyLabel(policy: string): string {
  switch (policy) {
    case "WARN_ONLY":
      return "Só avisos (não bloqueia)";
    case "BLOCK_ORDER":
      return "Bloqueia pedido";
    case "REQUIRE_APPROVAL":
      return "Pedido vai para aprovação";
    default:
      return policy;
  }
}
