import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ExternalLink } from "lucide-react";
import {
  LINKS_INSTITUCIONAIS,
  METODOLOGIA_NOTA,
  OUTROS_ORCAMENTOS,
} from "@/lib/conteudo";

export function ChamadaPainel() {
  return (
    <section className="relative overflow-hidden bg-verde-escuro">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          background:
            "radial-gradient(80% 120% at 100% 0%, rgba(109,63,181,0.6) 0%, transparent 60%)",
        }}
      />
      <div className="relative mx-auto flex w-full max-w-6xl flex-col gap-6 px-5 py-16 sm:px-8 sm:py-20 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-2xl">
          <h2 className="text-balance text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Explore os dados do OSG
          </h2>
          <p className="mt-4 text-pretty leading-relaxed text-white/80">
            Filtre por exercício, eixo, categoria e órgão executor; veja as
            entregas de cada dotação e exporte o recorte em XLSX ou PDF.
          </p>
        </div>
        <Link
          href="/painel"
          className="inline-flex shrink-0 items-center gap-2 self-start rounded-lg bg-amarelo px-6 py-3.5 text-sm font-semibold text-verde-escuro transition-opacity hover:opacity-90 lg:self-auto"
        >
          Acessar painel interativo
          <ArrowRight className="size-4" aria-hidden />
        </Link>
      </div>
    </section>
  );
}

export function Rodape() {
  return (
    <footer className="border-t border-borda bg-superficie">
      <div className="mx-auto grid w-full max-w-6xl gap-10 px-5 py-14 sm:px-8 lg:grid-cols-[1.2fr_1fr_1fr]">
        <div>
          <Image
            src="/logos/seplan-horizontal-verde.png"
            alt="SEPLAN — Secretaria de Estado de Planejamento do Acre"
            width={420}
            height={120}
            className="h-11 w-auto dark:hidden"
          />
          <Image
            src="/logos/seplan-horizontal-branco.png"
            alt="SEPLAN — Secretaria de Estado de Planejamento do Acre"
            width={420}
            height={120}
            className="hidden h-11 w-auto dark:block"
          />
          <p className="mt-5 max-w-sm text-pretty text-sm leading-relaxed text-texto-2">
            Apuração conduzida pelo Comitê de Apuração do Orçamento Sensível ao
            Gênero (COSG) e sistematizada pelo Departamento de Estudos e
            Planejamento Orçamentário da SEPLAN.
          </p>
          <p className="mt-4 text-xs leading-relaxed text-texto-3">
            {METODOLOGIA_NOTA}
          </p>
        </div>

        <nav aria-label="Links institucionais">
          <h3 className="mb-4 text-xs font-semibold uppercase tracking-[0.14em] text-texto-3">
            Institucional
          </h3>
          <ul className="space-y-2.5">
            {LINKS_INSTITUCIONAIS.map((l) => (
              <li key={l.href}>
                <a
                  href={l.href}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex items-center gap-1.5 text-sm text-texto-2 hover:text-lilas"
                >
                  {l.rotulo}
                  <ExternalLink className="size-3" aria-hidden />
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label="Outros orçamentos temáticos">
          <h3 className="mb-4 text-xs font-semibold uppercase tracking-[0.14em] text-texto-3">
            Outros orçamentos temáticos
          </h3>
          <ul className="space-y-2.5">
            {OUTROS_ORCAMENTOS.map((o) => (
              <li key={o.href}>
                <a
                  href={o.href}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex items-center gap-1.5 text-sm text-texto-2 hover:text-lilas"
                >
                  <span className="font-medium text-texto">{o.sigla}</span>
                  {o.rotulo}
                  <ExternalLink className="size-3" aria-hidden />
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      <div className="border-t border-borda">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-5 text-xs text-texto-3 sm:px-8">
          <p>
            Governo do Estado do Acre · Secretaria de Estado de Planejamento —
            SEPLAN
          </p>
          <Link href="/admin" className="hover:text-texto-2">
            Área restrita
          </Link>
        </div>
      </div>
    </footer>
  );
}
