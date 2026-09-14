import type { Metadata } from "next";
import Script from "next/script";
import { Inter } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--fonte",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://osgacre.vercel.app"),
  title: {
    default: "Orçamento Sensível ao Gênero — Acre",
    template: "%s · OSG Acre",
  },
  description:
    "Acompanhamento da execução do Orçamento Sensível ao Gênero do Estado do Acre, instituído pela Lei nº 4.168, de 6 de setembro de 2023.",
  openGraph: {
    title: "Orçamento Sensível ao Gênero — Acre",
    description:
      "Painel público de acompanhamento das dotações do Estado do Acre com entregas destinadas às mulheres.",
    locale: "pt_BR",
    type: "website",
  },
  // Sem `icons` aqui de propósito: `icon.png` e `apple-icon.png` estão em
  // `src/app/` e o Next os detecta pela convenção de arquivo, emitindo as tags
  // com URL versionada. Declarar também no metadata faria os dois competirem.
  // Para trocar a marca, rode `python scripts/icones.py <png>`.
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        {process.env.NODE_ENV === "development" && (
          <Script
            src="//unpkg.com/react-grab/dist/index.global.js"
            crossOrigin="anonymous"
            strategy="beforeInteractive"
          />
        )}
      </head>
      <body className={`${inter.variable} font-sans antialiased`}>
        <ThemeProvider attribute="data-theme" defaultTheme="system" enableSystem>
          {children}
          <Toaster position="top-right" richColors closeButton />
        </ThemeProvider>
      </body>
    </html>
  );
}
