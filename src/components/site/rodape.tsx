import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ExternalLink } from "lucide-react";
import {
  EQUIPE_DEPPO,
  LINKS_INSTITUCIONAIS,
  OUTROS_ORCAMENTOS,
} from "@/lib/conteudo";
import { LARGURA_CONTEUDO } from "@/components/ui/primitivos";
import { cn } from "@/lib/utils";

/** Um grupo da equipe: o rótulo do grupo e as pessoas, com nome e cargo. */
function ListaEquipe({
  titulo,
  pessoas,
  className,
  listaClassName,
}: {
  titulo: string;
  pessoas: readonly { nome: string; cargo: string }[];
  className?: string;
  listaClassName?: string;
}) {
  return (
    <div className={className}>
      <h4 className="text-sm font-semibold text-texto">{titulo}</h4>
      <ul className={cn("mt-2 space-y-2", listaClassName)}>
        {pessoas.map((p) => (
          <li key={p.nome}>
            <span className="block text-sm leading-snug text-texto-2">
              {p.nome}
            </span>
            <span className="block text-xs leading-snug text-texto-3">
              {p.cargo}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

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
      <div
        className={cn(
          LARGURA_CONTEUDO,
          "relative flex flex-col gap-6 py-16 sm:py-20 lg:flex-row lg:items-center lg:justify-between"
        )}
      >
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
    <footer id="rodape" className="border-t border-borda bg-superficie">
      <div className={cn(LARGURA_CONTEUDO, "py-10 xl:py-12")}>
        {/* Identidade e navegação ficam juntas; créditos técnicos vêm abaixo,
            em uma faixa própria, porque são outra camada de informação. */}
        <div className="grid gap-x-10 gap-y-10 lg:grid-cols-2 xl:grid-cols-12 xl:gap-x-14">
          <div className="lg:col-span-2 xl:col-span-4">
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
            <p className="mt-5 max-w-md text-pretty text-sm leading-relaxed text-texto-2">
              Apuração conduzida pelo Comitê de Apuração do Orçamento Sensível ao
              Gênero (COSG) e sistematizada pelo Departamento de Estudos e
              Planejamento Orçamentário da SEPLAN.
            </p>
          </div>

          <nav
            aria-label="Links institucionais"
            className="xl:col-span-5"
          >
            <h3 className="mb-4 text-xs font-semibold uppercase tracking-[0.14em] text-texto-3">
              Institucional
            </h3>
            <ul className="grid gap-x-8 gap-y-2.5 sm:grid-cols-2">
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

          <nav
            aria-label="Outros orçamentos temáticos"
            className="xl:col-span-3"
          >
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

        <section
          aria-labelledby="equipe-deppo"
          className="mt-8 border-t border-borda pt-6"
        >
          <div className="grid gap-x-10 gap-y-5 lg:grid-cols-2 xl:grid-cols-12 xl:gap-x-14">
            <div className="lg:col-span-2 xl:col-span-3">
              <h3
                id="equipe-deppo"
                className="text-xs font-semibold uppercase tracking-[0.14em] text-texto-3"
              >
                {EQUIPE_DEPPO.sigla}
              </h3>
              <p className="mt-2 max-w-xs text-xs leading-relaxed text-texto-3">
                {EQUIPE_DEPPO.orgao}
              </p>
            </div>
            <ListaEquipe
              titulo="Coordenação"
              pessoas={EQUIPE_DEPPO.coordenacao}
              className="xl:col-span-2"
            />
            <ListaEquipe
              titulo="Equipe técnica"
              pessoas={EQUIPE_DEPPO.tecnica}
              className="xl:col-span-7"
              listaClassName="grid gap-x-8 gap-y-3 space-y-0 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
            />
          </div>
        </section>
      </div>

      <div className="border-t border-borda">
        <div
          className={cn(
            LARGURA_CONTEUDO,
            "flex flex-wrap items-center justify-between gap-3 py-5 text-xs text-texto-3"
          )}
        >
          <div className="space-y-1.5">
            <p>
              Governo do Estado do Acre · Secretaria de Estado de Planejamento
              — SEPLAN
            </p>
            <address className="not-italic leading-relaxed">
              Av. Getúlio Vargas, 232 – Centro – Rio Branco – Acre – CEP:
              69900-060 – Palácio das Secretarias – Fone{" "}
              <a
                href="tel:+556832152514"
                className="whitespace-nowrap hover:text-texto-2"
              >
                (68) 3215-2514
              </a>
            </address>
          </div>
          <Link href="/admin" className="hover:text-texto-2">
            Área restrita
          </Link>
        </div>
      </div>
    </footer>
  );
}
