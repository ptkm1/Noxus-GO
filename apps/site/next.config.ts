import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@pedidos/shared", "@pedidos/design-tokens"],
};

export default nextConfig;
