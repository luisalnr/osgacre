/// <reference types="react/canary" />
import type { Metadata } from "next";
import Script from "next/script";
import { Inter } from "next/font/google";
import { ViewTransition } from "react";
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
    // `data-scroll-behavior`: o `scroll-behavior: smooth` do globals.css serve às
    // âncoras do site, mas numa troca de rota o Next só o desliga com este
    // atributo. Sem ele, quem clicava em "Acessar painel" no rodapé via a página
    // rolar animada até o topo no meio da transição.
    <html lang="pt-BR" suppressHydrationWarning data-scroll-behavior="smooth">
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
          {/* Com `experimental.viewTransition`, cada navegação entre páginas
              esmaece a tela velha sobre a nova (duração em globals.css). O
              Toaster fica fora para os avisos não entrarem na captura. */}
          <ViewTransition>{children}</ViewTransition>
          <Toaster position="top-right" richColors closeButton />
        </ThemeProvider>
      </body>
    </html>
  );
}
