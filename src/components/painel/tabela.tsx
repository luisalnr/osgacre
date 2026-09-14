"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, ChevronDown, ChevronRight, Info } from "lucide-react";
import {
  agruparEmDotacoes,
  anotacaoDotacao,
  fontesDaDotacao,
  linhasDoQdd,
  pesoNaDotacao,
  rotuloBase,
  veioDoQdd,
  type IndiceQdd,
  type PesoDotacao,
} from "@/lib/agregacoes";
import { corDoEixo } from "@/lib/cores";
import { moeda, percentual } from "@/lib/formato";
import {
  emApuracao,
  nomeEixo,
  nomeFonte,
  nomeFuncao,
  nomePrograma,
} from "@/lib/referencias";
import type { Dotacao, Registro } from "@/lib/types";
import { Botao, Card, Etiqueta } from "@/components/ui/primitivos";
import { cn } from "@/lib/utils";

type Ordem = "aprop" | "liq" | "execucao" | "orgao";

const PAGINA = 25;

/**
 * Tabela de dotações. Cada linha é uma dotação — (exercício, órgão, projeto/
 * atividade) — e abre para mostrar as entregas apropriadas dentro dela, que é a
 * granularidade real do registro.
 *
 * Só as duas colunas do OSG aparecem. O orçamento da dotação inteira fica na
 * linha expandida, como o percentual de participação do OSG.
 */
export function TabelaDotacoes({
  registros,
  qdd,
}: {
  registros: Registro[];
  qdd: IndiceQdd | null;
}) {
  const [ordem, setOrdem] = useState<Ordem>("aprop");
  const [visiveis, setVisiveis] = useState(PAGINA);
  const [abertas, setAbertas] = useState<Set<string>>(new Set());

  // Todo o recorte está em exercício de execução aberta: as colunas de liquidado
  // e execução ficam anotadas em vez de numeradas, e as ordenações por elas saem
  // do seletor — ordenar por um valor que não se pode ver não leva a lugar nenhum.
  const apurando = registros.length > 0 && registros.every((r) => emApuracao(r.ano));
  const ordemEfetiva: Ordem =
    apurando && (ordem === "liq" || ordem === "execucao") ? "aprop" : ordem;

  const dotacoes = useMemo(() => {
    const lista = agruparEmDotacoes(registros);
    const ordenado = [...lista];
    ordenado.sort((a, b) => {
      // Pelo NOME do órgão, não pelo código: o rótulo do seletor promete "A-Z",
      // e ordenar por `orgaoCodigo` entregaria ordem numérica de código.
      if (ordemEfetiva === "orgao")
        return (
          a.orgaoNome.localeCompare(b.orgaoNome, "pt-BR") ||
          a.unidadeNome.localeCompare(b.unidadeNome, "pt-BR")
        );
      if (ordemEfetiva === "liq") return b.liqOsg - a.liqOsg;
      if (ordemEfetiva === "execucao") {
        const ea = a.apropOsg ? a.liqOsg / a.apropOsg : -1;
        const eb = b.apropOsg ? b.liqOsg / b.apropOsg : -1;
        return eb - ea;
      }
      return b.apropOsg - a.apropOsg;
    });
    return ordenado;
  }, [registros, ordemEfetiva]);

  const alternar = (chave: string) =>
    setAbertas((atual) => {
      const proximo = new Set(atual);
      if (proximo.has(chave)) proximo.delete(chave);
      else proximo.add(chave);
      return proximo;
    });

  if (!dotacoes.length) {
    return (
      <Card className="p-10 text-center text-sm text-texto-3">
        Nenhuma dotação corresponde aos filtros selecionados.
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-borda px-5 py-4">
        <div>
          <h3 className="text-sm font-semibold text-texto">Dotações detalhadas</h3>
          <p className="mt-0.5 text-xs text-texto-3">
            {dotacoes.length} dotações · clique para ver as entregas apropriadas
            {apurando
              ? " · liquidado e execução ocultos enquanto o exercício não fecha"
              : ""}
          </p>
        </div>
        <label className="flex items-center gap-2 text-xs text-texto-3">
          Ordenar por
          <select
            value={ordemEfetiva}
            onChange={(e) => setOrdem(e.target.value as Ordem)}
            className="h-8 rounded-lg border border-borda-forte bg-superficie px-2 text-xs text-texto"
          >
            <option value="aprop">Maior valor planejado</option>
            {apurando ? null : (
              <>
                <option value="liq">Maior liquidação</option>
                <option value="execucao">Maior execução</option>
              </>
            )}
            <option value="orgao">Órgão (A-Z)</option>
          </select>
        </label>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead>
            <tr className="border-b border-borda text-xs uppercase tracking-wide text-texto-3">
              <th scope="col" className="w-8 py-3 pl-5" />
              <th scope="col" className="py-3 pr-4 font-medium">
                Órgão
              </th>
              <th scope="col" className="py-3 pr-4 font-medium">
                Aplicação programada
              </th>
              <th scope="col" className="py-3 pr-4 font-medium">
                Eixo
              </th>
              <th scope="col" className="py-3 pr-4 text-right font-medium">
                Valor planejado OSG
              </th>
              {/* As colunas ficam na tabela mesmo vazias: retirá-las mudaria a
                  largura de tudo e faria a tabela de 2026 parecer outra tabela.
                  O rótulo assinala a ausência em vez de escondê-la. */}
              <th scope="col" className="py-3 pr-4 text-right font-medium">
                Liquidado
                {apurando ? (
                  <span className="block font-normal normal-case tracking-normal text-texto-3">
                    em apuração
                  </span>
                ) : null}
              </th>
              <th scope="col" className="py-3 pr-5 text-right font-medium">
                Execução
                {apurando ? (
                  <span className="block font-normal normal-case tracking-normal text-texto-3">
                    em apuração
                  </span>
                ) : null}
              </th>
            </tr>
          </thead>
          <tbody>
            {dotacoes.slice(0, visiveis).map((d) => (
              <LinhaDotacao
                key={d.chave}
                dotacao={d}
                qdd={qdd}
                aberta={abertas.has(d.chave)}
                aoAlternar={() => alternar(d.chave)}
                apurando={apurando}
              />
            ))}
          </tbody>
        </table>
      </div>

      {visiveis < dotacoes.length ? (
        <div className="border-t border-borda p-4 text-center">
          <Botao
            variante="secundario"
            onClick={() => setVisiveis((v) => v + PAGINA)}
          >
            Mostrar mais {Math.min(PAGINA, dotacoes.length - visiveis)} de{" "}
            {dotacoes.length - visiveis} restantes
          </Botao>
        </div>
      ) : null}
    </Card>
  );
}

function LinhaDotacao({
  dotacao: d,
  qdd,
  aberta,
  aoAlternar,
  apurando,
}: {
  dotacao: Dotacao;
  qdd: IndiceQdd | null;
  aberta: boolean;
  aoAlternar: () => void;
  /** Exercício com execução ainda aberta: liquidado e execução não são exibidos. */
  apurando: boolean;
}) {
  const execucao = d.apropOsg ? (d.liqOsg / d.apropOsg) * 100 : null;
  const peso = pesoNaDotacao(d, qdd);
  const Chevron = aberta ? ChevronDown : ChevronRight;

  return (
    <>
      <tr
        className={cn(
          "cursor-pointer border-b border-borda align-top transition-colors hover:bg-superficie-2/70",
          aberta && "bg-superficie-2/50"
        )}
        onClick={aoAlternar}
      >
        <td className="py-3 pl-5">
          <button
            type="button"
            aria-expanded={aberta}
            aria-label={aberta ? "Recolher entregas" : "Ver entregas"}
            className="text-texto-3"
            onClick={(e) => {
              e.stopPropagation();
              aoAlternar();
            }}
          >
            <Chevron className="size-4" aria-hidden />
          </button>
        </td>
        <td className="py-3 pr-4">
          {/* Órgão em cima, unidade orçamentária embaixo. Antes esta célula
              trazia a string composta da planilha ("721/302 - FUNDHACRE") e a
              linha expandida repetia a mesma coisa sob o rótulo "Unidade". */}
          <span className="block text-xs font-medium text-texto">
            {d.orgaoCodigo} {d.orgaoNome}
          </span>
          {d.unidadeCodigo ? (
            <span className="mt-0.5 block text-xs text-texto-3">
              {d.unidadeCodigo} {d.unidadeNome}
            </span>
          ) : null}
        </td>
        {/* Com o painel a 1760px sobra folga à direita: deixa a descrição usar
            parte dela em vez de quebrar em quatro linhas. */}
        <td className="max-w-md py-3 pr-4 xl:max-w-xl">
          <p className="text-pretty text-sm leading-snug text-texto">
            {d.aplicacaoProgramada}
          </p>
          <p className="tabular mt-0.5 text-xs text-texto-3">
            {d.projetoAtividade} · {nomeFuncao(d.funcaoCodigo)}
          </p>
        </td>
        <td className="py-3 pr-4">
          {/* Um eixo por linha: é raro ter mais de um, e empilhados cada nome
              fica junto da sua cor. */}
          {d.eixos.map((eixo) => (
            <span key={eixo} className="flex items-center gap-1.5">
              <span
                className="size-2 shrink-0 rounded-sm"
                style={{ background: corDoEixo(eixo) }}
                aria-hidden
              />
              <span className="text-xs text-texto-2">{nomeEixo(eixo)}</span>
            </span>
          ))}
          {/* flex-wrap: "Categoria N" por extenso é mais largo que "Cat. N", e
              uma dotação pode carregar mais de uma categoria. */}
          <div className="mt-1 flex flex-wrap gap-1">
            {d.categorias.map((c) => (
              <Etiqueta key={c} tom="lilas">
                Categoria {c}
              </Etiqueta>
            ))}
          </div>
        </td>
        <td className="tabular py-3 pr-4 text-right text-sm text-texto">
          {moeda(d.apropOsg)}
        </td>
        <td className="tabular py-3 pr-4 text-right text-sm text-texto">
          {apurando ? <span className="text-texto-3">—</span> : moeda(d.liqOsg)}
        </td>
        <td className="tabular py-3 pr-5 text-right text-sm font-medium text-texto">
          {apurando ? (
            <span className="font-normal text-texto-3">—</span>
          ) : execucao !== null ? (
            percentual(execucao)
          ) : (
            "—"
          )}
        </td>
      </tr>

      {aberta ? (
        <tr className="border-b border-borda bg-superficie-2/30">
          <td />
          <td colSpan={6} className="px-0 py-4 pr-5">
            <div className="mb-3 flex flex-wrap items-center gap-x-6 gap-y-1 text-xs text-texto-3">
              {/* A função também aparece na linha fechada, miúda ao lado do
                  projeto/atividade. Aqui ela ganha rótulo e nome oficial, junto
                  das outras classificações da dotação. */}
              <span>
                <span className="font-medium text-texto-2">Função: </span>
                {nomeFuncao(d.funcaoCodigo)}
              </span>
              <span>
                <span className="font-medium text-texto-2">Programa: </span>
                {nomePrograma(d.programaCodigo)}
              </span>
              <span>
                <span className="font-medium text-texto-2">Órgão: </span>
                {d.orgaoCodigo} {d.orgaoNome}
              </span>
              <span>
                <span className="font-medium text-texto-2">Unidade: </span>
                {d.unidadeCodigo
                  ? `${d.unidadeCodigo} ${d.unidadeNome}`
                  : "não identificada no QDD"}
              </span>
            </div>

            <ParticipacaoNaDotacao dotacao={d} peso={peso} />

            <FontesDeRecurso dotacao={d} qdd={qdd} />

            {d.entregas.some((e) => e.entrega) ? (
              <ul className="space-y-2">
                {d.entregas.map((e) => (
                  <li
                    key={e.id}
                    className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 rounded-lg bg-superficie px-3 py-2"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-pretty text-xs leading-relaxed text-texto-2">
                        {e.entrega || (
                          <span className="italic text-texto-3">
                            Entrega não descrita na planilha
                          </span>
                        )}
                      </p>
                      {/* A descrição só existe a partir de 2026 e é o que
                          distingue duas entregas de mesmo nome na mesma dotação. */}
                      {e.entregaDescricao && e.entregaDescricao !== e.entrega ? (
                        <p className="mt-0.5 text-pretty text-xs leading-relaxed text-texto-3">
                          {e.entregaDescricao}
                        </p>
                      ) : null}
                      {e.municipio || e.publicoBeneficiado ? (
                        <p className="mt-1 flex flex-wrap gap-x-4 text-xs text-texto-3">
                          {e.municipio ? <span>Município: {e.municipio}</span> : null}
                          {e.publicoBeneficiado ? (
                            <span>Público: {e.publicoBeneficiado}</span>
                          ) : null}
                        </p>
                      ) : null}
                    </div>
                    <p className="tabular shrink-0 text-right text-xs text-texto">
                      {moeda(e.apropOsg)}
                      {/* `planejadoEntrega` nulo com mais de uma entrega quer
                          dizer que a fonte informou o valor só na dotação e este
                          número saiu do rateio. Dizer isso é o que separa um
                          valor apurado de uma divisão feita aqui. */}
                      {e.planejadoEntrega === null && d.entregas.length > 1 ? (
                        <span
                          className="block text-texto-3"
                          title="O relatório informa o valor no nível da dotação; aqui ele foi dividido igualmente entre as entregas."
                        >
                          rateado
                        </span>
                      ) : null}
                      {apurando ? null : (
                        <span className="block text-texto-3">
                          liquidado {moeda(e.liqOsg)}
                        </span>
                      )}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rounded-lg bg-superficie px-3 py-2 text-xs italic text-texto-3">
                Esta dotação foi apropriada sem descrição de entregas na planilha
                de origem.
              </p>
            )}
          </td>
        </tr>
      ) : null}
    </>
  );
}

/**
 * De quais fontes de recurso sai a dotação, segundo o QDD.
 *
 * **Os valores são da dotação inteira, não do OSG.** A planilha do OSG não
 * reparte o valor apropriado por fonte, e nada aqui inventa esse rateio — por
 * isso a fonte é informação sobre a ação orçamentária, e a frase que diz isso
 * fica junto dos números, não numa nota de rodapé. Sem ela, quem soma a coluna
 * acredita estar somando OSG.
 *
 * Some inteiro quando não há QDD casado: `ParticipacaoNaDotacao`, logo acima, já
 * explicou que não há dotação informada para a ação, e repetir a ausência em
 * dois blocos seguidos só ocupa espaço.
 *
 * Quando a dotação casa com o QDD pelo recuo por ação — sem o órgão —, as fontes
 * são as do registro de OUTRO órgão executando a mesma ação orçamentária, e isso
 * precisa estar escrito. São 8 dotações de 2024, da PMAC, do CBMAC e da PCAC,
 * cujas fontes vêm todas do registro da SEJUSP. Sem o aviso, a tela atribui à
 * PMAC uma composição de recursos que não é dela.
 */
function FontesDeRecurso({
  dotacao: d,
  qdd,
}: {
  dotacao: Dotacao;
  qdd: IndiceQdd | null;
}) {
  const fontes = fontesDaDotacao(d, qdd);
  if (!fontes.length) return null;

  const deOutroOrgao = linhasDoQdd(d, qdd).origem === "qdd-projeto";

  return (
    <div className="mb-3 rounded-lg border border-borda bg-superficie px-3 py-2.5">
      <p className="text-xs font-medium text-texto-2">
        Fontes de recurso da dotação
        <span className="ml-1.5 font-normal text-texto-3">
          ({fontes.length === 1 ? "fonte única" : `${fontes.length} fontes`}) — valores
          da dotação inteira, do QDD; o OSG não é repartido por fonte.
        </span>
      </p>

      {deOutroOrgao ? (
        <p className="mt-1 flex items-start gap-1.5 text-xs leading-relaxed text-alerta">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <span className="text-pretty">
            Esta ação orçamentária não tem registro próprio no QDD deste órgão. As
            fontes abaixo são as do órgão que executa a mesma ação.
          </span>
        </p>
      ) : null}

      <ul className="mt-2 space-y-1.5">
        {fontes.map((f) => (
          <li
            key={f.fonte || "sem-fonte"}
            className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-0.5"
          >
            <span className="min-w-0 flex-1 text-xs leading-relaxed text-texto-2">
              {f.fonte ? (
                nomeFonte(f.fonte)
              ) : (
                <span className="italic text-texto-3">Fonte não informada no QDD</span>
              )}
            </span>
            <span className="tabular shrink-0 text-xs text-texto-3">
              inicial{" "}
              <span className="text-texto">{moeda(f.inicial)}</span>
              <span className="mx-1.5">→</span>
              atualizada <span className="text-texto">{moeda(f.atualizada)}</span>
              <span className="mx-1.5">·</span>
              liquidado <span className="text-texto">{moeda(f.liquidado)}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Quanto desta dotação foi apropriado ao OSG, com a dotação inicial e a
 * atualizada ao lado.
 *
 * O percentual só aparece quando o planejado cabe na base. Quando passa dela,
 * entra uma anotação no lugar do número: calculado sobre a inicial, o excesso
 * produziria coisas como 8.208% ou 27.375.190% (dotação inicial de R$ 1,00),
 * que não informam nada. A anotação distingue a dotação suplementada durante o
 * exercício — rotina orçamentária — do registro que precisa de conferência.
 */
function ParticipacaoNaDotacao({
  dotacao: d,
  peso,
}: {
  dotacao: Dotacao;
  peso: PesoDotacao;
}) {
  const { base } = peso;
  const doQdd = veioDoQdd(base.origem);
  const anotacao = anotacaoDotacao(base, moeda);

  return (
    <div className="mb-3 rounded-lg border border-borda bg-superficie px-3 py-2.5">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-xs">
        <span className="font-medium text-texto-2">
          Participação do OSG na dotação:
        </span>

        {peso.percentual !== null ? (
          <span className="tabular font-semibold text-texto">
            {percentual(peso.percentual)}
            <span className="ml-1 font-normal text-texto-3">
              da {rotuloBase(base)}
            </span>
          </span>
        ) : (
          <span
            className={
              base.situacao === "a-conferir"
                ? "inline-flex items-start gap-1.5 text-alerta"
                : "inline-flex items-start gap-1.5 text-texto-3"
            }
          >
            {base.situacao === "a-conferir" ? (
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            ) : (
              <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            )}
            <span className="text-pretty">
              {anotacao}
              {base.situacao !== "indisponivel" ? (
                <span className="tabular text-texto-3">
                  {" "}
                  Planejado: {moeda(d.apropOsg)}.
                </span>
              ) : null}
            </span>
          </span>
        )}
      </div>

      {base.inicial !== null || base.atualizada !== null ? (
        <p className="tabular mt-1.5 text-xs text-texto-3">
          Dotação inicial {moeda(base.inicial ?? 0)}
          <span className="mx-1.5">→</span>
          atualizada {moeda(base.atualizada ?? 0)}
          {/* No exercício em apuração o liquidado do QDD é um acumulado
              parcial, e a apropriação do OSG sobre ele mais ainda. Some com os
              dois; a dotação inicial e a atualizada continuam, que são números
              da lei orçamentária e já estão fechados. */}
          {base.liquidadoProjeto !== null && !emApuracao(d.ano) ? (
            <>
              <span className="mx-1.5">·</span>
              liquidado da dotação {moeda(base.liquidadoProjeto)}
              <span className="mx-1.5">·</span>
              do OSG {moeda(d.liqOsg)}
            </>
          ) : null}
          <span className="ml-1.5 text-texto-3/70">
            ({doQdd ? "QDD" : "planilha do OSG"})
          </span>
        </p>
      ) : null}

      {/*
        Emenda parlamentar cujo planejado foi recuperado do QDD. Dizer isso é o
        que separa um número apurado pelo COSG de um número calculado na
        importação — o relatório de origem informa zero para estas dotações, e
        quem confere o painel contra ele precisa saber por que os dois diferem.
      */}
      {d.planejadoOrigem === "dotacao-atualizada" ? (
        <p className="mt-1.5 text-pretty text-xs leading-relaxed text-texto-3">
          Emenda parlamentar: entra na lei orçamentária com dotação inicial zerada
          e só recebe valor depois da alocação do plano de trabalho. O planejado
          acima é a <strong className="font-medium text-texto-2">dotação
          atualizada</strong> do QDD, não o valor informado pelo relatório do
          exercício — que para as emendas é sempre zero.
        </p>
      ) : null}
    </div>
  );
}
