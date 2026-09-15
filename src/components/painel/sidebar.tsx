"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Database, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { SECOES, type SecaoId } from "./secoes";
import { cn } from "@/lib/utils";

/**
 * Navegação do painel.
 *
 * Em `lg` e acima é uma coluna fixa à esquerda, que acompanha a rolagem. Abaixo
 * disso a coluna não cabe e vira uma fileira horizontal rolável — e não uma
 * gaveta: gaveta exige prender o foco, tratar Esc e travar a rolagem do fundo,
 * trabalho que três itens não justificam.
 */
export function Sidebar({
  ativa,
  aoTrocar,
  recolhida,
  aoRecolher,
}: {
  ativa: SecaoId;
  aoTrocar: (id: SecaoId) => void;
  recolhida: boolean;
  aoRecolher: () => void;
}) {
  const Recolher = recolhida ? PanelLeftOpen : PanelLeftClose;

  return (
    <>
      {/* Coluna do desktop */}
      <aside
        className={cn(
          "hidden shrink-0 border-r border-borda bg-superficie lg:sticky lg:top-0 lg:block lg:h-dvh",
          recolhida ? "lg:w-[72px]" : "lg:w-[260px]"
        )}
      >
        <div className="flex h-full flex-col p-3">
          {/*
            O botão de recolher divide a fileira com o rótulo da navegação. Ele
            já esteve sozinho numa fileira própria, encostado à direita, e lia
            como um ícone solto no vazio — encostar num rótulo lhe dá âncora.
          */}
          <div
            className={cn(
              "mb-2 flex items-center",
              recolhida ? "justify-center" : "justify-between pl-3"
            )}
          >
            {recolhida ? null : (
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-texto-3">
                Navegação
              </span>
            )}
            <button
              type="button"
              onClick={aoRecolher}
              aria-expanded={!recolhida}
              aria-label={recolhida ? "Expandir menu" : "Recolher menu"}
              className="rounded-lg p-2 text-texto-3 transition-colors hover:bg-superficie-2 hover:text-texto"
            >
              <Recolher className="size-4" aria-hidden />
            </button>
          </div>

          {/* As seções vêm primeiro: são o motivo da barra existir. Antes o
              link de saída ficava no topo e empurrava a navegação para baixo. */}
          <nav aria-label="Seções do painel" className="flex flex-col gap-1">
            {SECOES.map((s) => {
              const Icone = s.icone;
              const atual = s.id === ativa;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => aoTrocar(s.id)}
                  aria-current={atual ? "page" : undefined}
                  title={recolhida ? s.rotulo : undefined}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors",
                    atual
                      ? "bg-lilas text-white"
                      : "text-texto-2 hover:bg-superficie-2 hover:text-texto",
                    recolhida && "justify-center px-0"
                  )}
                >
                  <Icone className="size-4 shrink-0" aria-hidden />
                  {recolhida ? null : s.rotulo}
                </button>
              );
            })}
          </nav>

          {/* Sair do painel não é uma seção dele: o filete separa as duas coisas. */}
          <hr className="my-3 border-borda" />

          <Link
            href="/"
            title={recolhida ? "Voltar ao site" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-texto-3 transition-colors hover:bg-superficie-2 hover:text-texto",
              recolhida && "justify-center px-0"
            )}
          >
            <ArrowLeft className="size-4 shrink-0" aria-hidden />
            {recolhida ? null : "Voltar ao site"}
          </Link>

          {/*
            Ilustração no vão que o `mt-auto` abria entre a navegação e o
            rodapé. Decorativa: `alt=""` para o leitor de tela pular, porque ela
            não diz nada que o texto ao redor já não diga.

            Some quando a barra está recolhida (72 px não comportam a arte) e
            quando a janela é baixa — abaixo de 760 px de altura ela empurraria
            o rodapé para fora da coluna. É por isso que o `mt-auto` mudou para
            cá: assim a ilustração e o rodapé descem juntos, colados, em vez de
            sobrar um vão entre os dois.

            `sizes` fixo na largura útil da coluna (260 px menos o padding): sem
            ele o Next escolheria uma variante de até 3840 px para uma imagem
            que nunca passa de 236.
          */}
          {recolhida ? null : (
            <div className="mt-auto hidden px-3 pt-6 [@media(min-height:760px)]:block">
              <Image
                src="/ilustracoes/mulheres_na_mesa_sem_fundo_dados.png"
                alt=""
                width={1254}
                height={1254}
                sizes="236px"
                className="h-auto w-full object-contain"
              />
            </div>
          )}

          <footer
            className={cn(
              "mt-auto border-t border-borda pt-4",
              recolhida
                ? "flex justify-center"
                : // Expandida e com janela alta, quem empurra é a ilustração; o
                  // rodapé troca o `mt-auto` por um respiro fixo para encostar
                  // nela. Em janela baixa a ilustração não existe, e o `mt-auto`
                  // do rodapé volta a valer sozinho.
                  "px-3 [@media(min-height:760px)]:mt-4"
            )}
            title={recolhida ? "Fonte dos dados: COSG e DEPPO/SEPLAN" : undefined}
          >
            {recolhida ? (
              <>
                <Database className="size-4 text-texto-3" aria-hidden />
                <span className="sr-only">
                  Fonte dos dados: COSG e DEPPO/SEPLAN
                </span>
              </>
            ) : (
              <div className="flex items-start gap-2.5">
                <Database className="mt-0.5 size-4 shrink-0 text-texto-3" aria-hidden />
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-texto-3">
                    Fonte dos dados
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-texto-2">
                    COSG e DEPPO/SEPLAN
                  </p>
                </div>
              </div>
            )}
          </footer>
        </div>
      </aside>

      {/* Fileira do celular e do tablet */}
      <nav
        aria-label="Seções do painel"
        className="flex gap-1 overflow-x-auto border-b border-borda bg-superficie px-3 py-2 lg:hidden"
      >
        {SECOES.map((s) => {
          const Icone = s.icone;
          const atual = s.id === ativa;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => aoTrocar(s.id)}
              aria-current={atual ? "page" : undefined}
              className={cn(
                "inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                atual
                  ? "bg-lilas text-white"
                  : "text-texto-2 hover:bg-superficie-2"
              )}
            >
              <Icone className="size-4" aria-hidden />
              {s.rotulo}
            </button>
          );
        })}
      </nav>
    </>
  );
}
