import { corDoEixo } from "@/lib/cores";
import { moedaCurta, percentual } from "@/lib/formato";
import { EIXOS } from "@/lib/referencias";
import { Card, Secao, TituloSecao } from "@/components/ui/primitivos";

export type ValorEixo = { aprop: number; liq: number; participacao: number };

/**
 * Os seis eixos da Lei nº 4.168/2023, na ordem da lei, com o valor apropriado
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
        descricao="A lei organiza o Orçamento Sensível ao Gênero em seis eixos, cada um reunindo funções orçamentárias específicas. Os valores abaixo são a apropriação planejada do exercício mais recente."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {EIXOS.map((eixo) => {
          const v = valores[eixo.slug];
          const cor = corDoEixo(eixo.slug);
          return (
            <Card
              key={eixo.slug}
              className="flex flex-col p-5 transition-shadow hover:shadow-card-alta"
            >
              <div className="mb-4 flex items-start justify-between gap-3">
                <span
                  className="flex size-9 items-center justify-center rounded-lg text-sm font-semibold text-white"
                  style={{ background: cor }}
                  aria-hidden
                >
                  {eixo.romano}
                </span>
                {v ? (
                  <div className="text-right">
                    <p className="tabular text-lg font-semibold text-texto">
                      {moedaCurta(v.aprop)}
                    </p>
                    <p className="text-xs text-texto-3">
                      {percentual(v.participacao)} do OSG
                      {exercicio ? ` em ${exercicio}` : ""}
                    </p>
                  </div>
                ) : null}
              </div>

              <h3 className="text-base font-semibold text-texto">{eixo.nome}</h3>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-texto-2">
                {eixo.descricao}
              </p>

              <p className="mt-4 border-t border-borda pt-3 text-xs leading-relaxed text-texto-3">
                <span className="font-medium text-texto-2">Funções: </span>
                {eixo.funcoes.join("; ")}.
              </p>
            </Card>
          );
        })}
      </div>
    </Secao>
  );
}
