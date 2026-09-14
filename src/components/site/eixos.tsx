import { corDoEixo } from "@/lib/cores";
import { moedaCurta, percentual } from "@/lib/formato";
import { EIXOS } from "@/lib/referencias";
import { Secao, TituloSecao } from "@/components/ui/primitivos";

/** `liq` é `null` no exercício de execução ainda aberta. */
export type ValorEixo = { aprop: number; liq: number | null; participacao: number };

/**
 * Os seis eixos da Lei nº 4.168/2023, na ordem da lei, com o valor planejado
 * no exercício mais recente. A ordem é a da norma — não por valor — para que a
 * numeração romana continue fazendo sentido e a cor de cada eixo fique estável.
 */
export function Eixos({
  exercicio,
  valores,
}: {
  exercicio: number | null;
  valores: Record<string, ValorEixo>;
}) {
  return (
    <Secao id="eixos" className="bg-superficie-2/60">
      <TituloSecao
        sobretitulo="Art. 4º da Lei nº 4.168/2023"
        titulo="Eixos temáticos"
        descricao={
          exercicio
            ? `Distribuição do valor planejado do OSG pelos seis eixos definidos na lei, no exercício de ${exercicio}.`
            : "Os seis eixos definidos pela lei para organizar o Orçamento Sensível ao Gênero."
        }
      />

      {/* Lista editorial, sem a moldura e os efeitos de uma grade de cartões.
          A pequena linha colorida mantém a identificação visual de cada eixo
          sem transformar a numeração legal em um badge decorativo. */}
      <div className="grid border-b border-borda sm:grid-cols-2 sm:gap-x-10 lg:grid-cols-3">
        {EIXOS.map((eixo) => {
          const v = valores[eixo.slug];
          const cor = corDoEixo(eixo.slug);
          return (
            <article
              key={eixo.slug}
              className="relative border-t border-borda py-7"
            >
              <span
                className="absolute left-0 top-[-1px] h-0.5 w-10"
                style={{ background: cor }}
                aria-hidden
              />

              <div className="flex items-start justify-between gap-6">
                <div className="min-w-0">
                  <p
                    className="text-xs font-semibold uppercase tracking-[0.14em]"
                    style={{ color: cor }}
                  >
                    Eixo {eixo.romano}
                  </p>
                  <h3 className="mt-2 text-base font-semibold text-texto">
                    {eixo.nome}
                  </h3>
                </div>

                {v ? (
                  <div className="shrink-0 text-right">
                    <p className="tabular text-base font-semibold text-texto">
                      {moedaCurta(v.aprop)}
                    </p>
                    <p className="mt-1 text-xs text-texto-3">
                      {percentual(v.participacao)} do total
                    </p>
                  </div>
                ) : null}
              </div>

              <p className="mt-4 max-w-xl text-sm leading-relaxed text-texto-2">
                {eixo.descricao}
              </p>

              <p className="mt-4 text-xs leading-relaxed text-texto-3">
                <span
                  className="mr-1 font-medium uppercase tracking-wide text-texto-2"
                >
                  Funções
                </span>
                {eixo.funcoes.join("; ")}.
              </p>
            </article>
          );
        })}
      </div>
    </Secao>
  );
}
