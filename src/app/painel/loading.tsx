import Image from "next/image";
import { LARGURA_CONTEUDO } from "@/components/ui/primitivos";
import { cn } from "@/lib/utils";
import { RolarAoTopo } from "./rolar-topo";

/**
 * Tela de espera do painel.
 *
 * `/painel` é `force-dynamic` e traz os registros, o QDD e as leis de uma vez.
 * Sem esta fronteira, o clique em "Acessar painel" não dava sinal nenhum: o site
 * ficava parado até a resposta inteira chegar e então era trocado de uma vez.
 * Com ela, o Next pré-carrega este esqueleto junto com o link e o mostra no
 * instante do clique.
 *
 * O esqueleto repete a moldura real — a faixa verde, a coluna de 260 px, a
 * barra de filtros e a grade dos cartões — para que a chegada dos dados só
 * preencha o que já está no lugar, sem nada pular.
 */
export default function CarregandoPainel() {
  return (
    <div className="aparecer min-h-dvh bg-fundo" role="status" aria-live="polite">
      <RolarAoTopo />
      <span className="sr-only">Carregando o painel…</span>

      <header className="border-b border-borda bg-verde-escuro">
        <div className="flex items-center gap-4 px-5 py-5 sm:px-8">
          <span className="relative block h-10 w-[165px] shrink-0">
            <Image
              src="/logos/seplan-horizontal-branco.png"
              alt=""
              fill
              priority
              sizes="165px"
              className="object-contain object-left"
            />
          </span>
          <span className="hidden h-8 w-px bg-white/25 sm:block" />
          <p className="min-w-0 text-xl font-semibold tracking-tight text-white sm:text-2xl">
            Painel do Orçamento Sensível ao Gênero
          </p>
        </div>
      </header>

      <div className="flex flex-col lg:flex-row" aria-hidden>
        <aside className="hidden shrink-0 border-r border-borda bg-superficie p-3 lg:block lg:h-dvh lg:w-[260px]">
          <Bloco className="mb-4 ml-3 mt-2 h-3 w-24" />
          <div className="flex flex-col gap-2">
            {[0, 1, 2, 3].map((i) => (
              <Bloco key={i} className="h-10 w-full rounded-lg" />
            ))}
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <div className="border-b border-borda bg-fundo">
            <div className={cn(LARGURA_CONTEUDO, "flex gap-3 py-4")}>
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className={cn("flex-1 space-y-2", i > 1 && "hidden md:block")}>
                  <Bloco className="h-3 w-16" />
                  <Bloco className="h-10 w-full rounded-lg" />
                </div>
              ))}
            </div>
          </div>

          <div className={cn(LARGURA_CONTEUDO, "space-y-6 py-6")}>
            <Bloco className="h-[4.5rem] w-full rounded-card" />
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
              {[0, 1, 2, 3, 4].map((i) => (
                <Bloco key={i} className="h-28 rounded-card" />
              ))}
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <Bloco className="h-96 rounded-card" />
              <Bloco className="h-96 rounded-card" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Bloco({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded bg-superficie-2", className)} />;
}
