import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { Toaster } from "@/components/ui/sonner";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const siteName = process.env.NEXT_PUBLIC_SITE_NAME ?? "E-commerce Core";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: siteName,
    template: `%s | ${siteName}`,
  },
  description:
    "E-commerce Core — plataforma de e-commerce modular e extensível: catálogo genérico, variantes por atributos, estoque com reservas, checkout idempotente e pagamentos/frete plugáveis.",
  applicationName: siteName,
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName,
    url: siteUrl,
    title: `${siteName} — plataforma de e-commerce modular`,
    description:
      "Um núcleo genérico para roupas, eletrônicos, alimentos e outros segmentos. A loja é uma demonstração.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="bg-background text-foreground flex min-h-full flex-col">
        {children}
        <Toaster richColors position="top-center" />
      </body>
    </html>
  );
}
