import Image from "next/image";
import Link from "next/link";
import { ArrowRight, FileText } from "lucide-react";
import { HERO } from "@/lib/conteudo";
import { moedaCurta, percentual } from "@/lib/formato";

type Props = {
  exercicio: number | null;
  aprop: number;
  liq: number;
  execucao: number | null;
  dotacoes: number;
};

/**
 * Hero com os números do exercício mais recente já visíveis. A ideia é que quem
 * chega pelo site institucional saia da primeira dobra sabendo a ordem de
 * grandeza do OSG, sem precisar abrir o painel.
 */
export function Hero({ exercicio, aprop, liq, execucao, dotacoes }: Props) {
  return (
    <section className="relative overflow-hidden bg-verde-escuro pt-16">
      {/* Faixa decorativa: o degradê some atrás do conteúdo, sem competir com o texto. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          background:
            "radial-gradient(120% 90% at 85% 10%, rgba(109,63,181,0.55) 0%, transparent 55%), radial-gradient(90% 70% at 0% 100%, rgba(0,148,75,0.45) 0%, transparent 60%)",
        }}
      />

      <div className="relative mx-auto grid w-full max-w-6xl gap-10 px-5 pb-16 pt-14 sm:px-8 sm:pb-20 sm:pt-20 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        <div>
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.14em] text-white/90">
            {HERO.chapeu}
          </p>
          <h1 className="text-balance text-4xl font-semibold leading-[1.08] tracking-tight text-white sm:text-5xl lg:text-6xl">
            {HERO.titulo}
          </h1>
          <p className="mt-5 max-w-xl text-pretty text-base leading-relaxed text-white/80 sm:text-lg">
            {HERO.subtitulo}
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/painel"
              className="inline-flex items-center gap-2 rounded-lg bg-amarelo px-5 py-3 text-sm font-semibold text-verde-escuro transition-opacity hover:opacity-90"
            >
              Acessar painel interativo
              <ArrowRight className="size-4" aria-hidden />
            </Link>
            <Link
              href="/#relatorios"
              className="inline-flex items-center gap-2 rounded-lg border border-white/25 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10"
            >
              <FileText className="size-4" aria-hidden />
              Relatórios publicados
            </Link>
          </div>

          {exercicio ? (
            <dl className="mt-10 grid max-w-lg grid-cols-2 gap-x-6 gap-y-5 border-t border-white/15 pt-6 sm:grid-cols-4">
              <NumeroHero rotulo="Exercício" valor={String(exercicio)} />
              <NumeroHero rotulo="Planejado" valor={moedaCurta(aprop)} />
              <NumeroHero rotulo="Liquidado" valor={moedaCurta(liq)} />
              <NumeroHero
                rotulo="Dotações"
                valor={String(dotacoes)}
                nota={execucao !== null ? `${percentual(execucao)} executado` : undefined}
              />
            </dl>
          ) : null}
        </div>

        <div className="relative mx-auto hidden w-full max-w-md lg:block">
          <Image
            src="/ilustracoes/mulheres-recorte.png"
            alt="Ilustração de mulheres de diferentes idades, origens e ocupações"
            width={1240}
            height={1240}
            priority
            className="h-auto w-full drop-shadow-2xl"
          />
        </div>
      </div>
    </section>
  );
}

function NumeroHero({
  rotulo,
  valor,
  nota,
}: {
  rotulo: string;
  valor: string;
  nota?: string;
}) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-white/60">
        {rotulo}
      </dt>
      <dd className="tabular mt-1 text-lg font-semibold text-white">{valor}</dd>
      {nota ? <p className="text-xs text-white/60">{nota}</p> : null}
    </div>
  );
}
