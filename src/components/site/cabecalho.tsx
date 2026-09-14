"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { BarChart3, Menu, X } from "lucide-react";
import { NAVEGACAO } from "@/lib/conteudo";
import { LARGURA_CONTEUDO } from "@/components/ui/primitivos";
import { cn } from "@/lib/utils";

/**
 * Cabeçalho fixo. Começa transparente sobre a faixa verde do hero e ganha fundo
 * sólido assim que a página rola, para o logo branco não competir com o texto.
 */
export function Cabecalho() {
  const [rolou, setRolou] = useState(false);
  const [aberto, setAberto] = useState(false);

  useEffect(() => {
    const aoRolar = () => setRolou(window.scrollY > 24);
    aoRolar();
    window.addEventListener("scroll", aoRolar, { passive: true });
    return () => window.removeEventListener("scroll", aoRolar);
  }, []);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-colors duration-300",
        rolou || aberto
          ? "border-b border-white/10 bg-verde-escuro/95 backdrop-blur"
          : "bg-transparent"
      )}
    >
      <div className={cn(LARGURA_CONTEUDO, "flex h-16 items-center gap-4")}>
        <Link href="/" className="flex items-center gap-3" aria-label="Página inicial">
          {/* O arquivo é 3113x439, ou 7,09:1 — bem mais largo que esta caixa.
              Com object-contain quem limita é a largura, então a marca ocupa
              ~23px de altura aqui dentro e sobra folga em cima e embaixo. Para
              aumentá-la de verdade, é a LARGURA que precisa crescer. */}
          <span className="relative block h-10 w-[165px]">
            <Image
              src="/logos/seplan-horizontal-branco.png"
              alt="SEPLAN — Secretaria de Estado de Planejamento do Acre"
              fill
              priority
              sizes="165px"
              className="object-contain object-left"
            />
          </span>
          <span className="hidden h-6 w-px bg-white/25 sm:block" />
          <span className="hidden text-sm font-semibold text-white sm:block">OSG</span>
        </Link>

        <nav className="ml-auto hidden items-center gap-1 md:flex">
          {NAVEGACAO.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-lg px-3 py-2 text-sm font-medium text-white/85 transition-colors hover:bg-white/10 hover:text-white"
            >
              {item.rotulo}
            </Link>
          ))}
          <Link
            href="/painel"
            className="ml-2 inline-flex items-center gap-2 rounded-lg bg-amarelo px-4 py-2 text-sm font-semibold text-verde-escuro transition-opacity hover:opacity-90"
          >
            <BarChart3 className="size-4" aria-hidden />
            Acessar painel
          </Link>
        </nav>

        <button
          type="button"
          onClick={() => setAberto((v) => !v)}
          className="ml-auto rounded-lg p-2 text-white md:hidden"
          aria-expanded={aberto}
          aria-label={aberto ? "Fechar menu" : "Abrir menu"}
        >
          {aberto ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>

      {aberto ? (
        <nav className="border-t border-white/10 px-5 pb-4 md:hidden">
          {NAVEGACAO.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setAberto(false)}
              className="block rounded-lg px-3 py-2.5 text-sm font-medium text-white/85 hover:bg-white/10"
            >
              {item.rotulo}
            </Link>
          ))}
          <Link
            href="/painel"
            onClick={() => setAberto(false)}
            className="mt-2 flex items-center justify-center gap-2 rounded-lg bg-amarelo px-4 py-2.5 text-sm font-semibold text-verde-escuro"
          >
            <BarChart3 className="size-4" aria-hidden />
            Acessar painel
          </Link>
        </nav>
      ) : null}
    </header>
  );
}
