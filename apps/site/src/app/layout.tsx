import {
  APP_BRAND_NAME,
  APP_BRAND_PRIMARY,
  APP_BRAND_TAGLINE,
} from "@pedidos/shared";
import type { Metadata } from "next";
import { Sora } from "next/font/google";
import "./globals.css";

const sora = Sora({
  subsets: ["latin"],
  variable: "--font-sora",
  display: "swap",
});

export const metadata: Metadata = {
  title: `${APP_BRAND_NAME} — Planos`,
  description: `${APP_BRAND_TAGLINE} Gestão de pedidos, equipe e rota para equipes de vendas.`,
  verification: {
    google: "GJOepdKDdqgngAJVdXRULU9fqXaZSaI3xj0_g6XLETM",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body
        className={sora.variable}
        suppressHydrationWarning
        style={{
          fontFamily: "var(--font-sora), var(--font)",
          ["--brand" as string]: APP_BRAND_PRIMARY,
        }}
      >
        {children}
      </body>
    </html>
  );
}
