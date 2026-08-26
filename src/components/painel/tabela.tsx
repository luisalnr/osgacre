"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, ChevronDown, ChevronRight, Info } from "lucide-react";
import {
  agruparEmDotacoes,
  anotacaoDotacao,
  pesoNaDotacao,
  rotuloBase,
  type IndiceQdd,
  type PesoDotacao,
} from "@/lib/agregacoes";
import { corDoEixo } from "@/lib/cores";
import { moeda, percentual } from "@/lib/formato";
import { nomeEixo, nomeFuncao, nomePrograma } from "@/lib/referencias";
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

  const dotacoes = useMemo(() => {
    const lista = agruparEmDotacoes(registros);
    const ordenado = [...lista];
    ordenado.sort((a, b) => {
      if (ordem === "orgao") return a.orgaoSigla.localeCompare(b.orgaoSigla, "pt-BR");
      if (ordem === "liq") return b.liqOsg - a.liqOsg;
      if (ordem === "execucao") {
        const ea = a.apropOsg ? a.liqOsg / a.apropOsg : -1;
        const eb = b.apropOsg ? b.liqOsg / b.apropOsg : -1;
        return eb - ea;
      }
      return b.apropOsg - a.apropOsg;
    });
    return ordenado;
  }, [registros, ordem]);

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
          </p>
        </div>
        <label className="flex items-center gap-2 text-xs text-texto-3">
          Ordenar por
          <select
            value={ordem}
            onChange={(e) => setOrdem(e.target.value as Ordem)}
            className="h-8 rounded-lg border border-borda-forte bg-superficie px-2 text-xs text-texto"
          >
            <option value="aprop">Maior valor planejado</option>
            <option value="liq">Maior liquidação</option>
            <option value="execucao">Maior execução</option>
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
              <th scope="col" className="py-3 pr-4 text-right font-medium">
                Liquidado
              </th>
              <th scope="col" className="py-3 pr-5 text-right font-medium">
                Execução
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
}: {
  dotacao: Dotacao;
  qdd: IndiceQdd | null;
  aberta: boolean;
  aoAlternar: () => void;
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
          <span className="text-xs font-medium text-texto">{d.orgaoSigla}</span>
        </td>
        <td className="max-w-md py-3 pr-4">
          <p className="text-pretty text-sm leading-snug text-texto">
            {d.aplicacaoProgramada}
          </p>
          <p className="tabular mt-0.5 text-xs text-texto-3">
            {d.projetoAtividade} · {nomeFuncao(d.funcaoCodigo)}
          </p>
        </td>
        <td className="py-3 pr-4">
          <span className="inline-flex items-center gap-1.5">
            <span
              className="size-2 shrink-0 rounded-sm"
              style={{ background: corDoEixo(d.eixo) }}
              aria-hidden
            />
            <span className="text-xs text-texto-2">{nomeEixo(d.eixo)}</span>
          </span>
          <div className="mt-1 flex gap-1">
            {d.categorias.map((c) => (
              <Etiqueta key={c} tom="lilas">
                Cat. {c}
              </Etiqueta>
            ))}
          </div>
        </td>
        <td className="tabular py-3 pr-4 text-right text-sm text-texto">
          {moeda(d.apropOsg)}
        </td>
        <td className="tabular py-3 pr-4 text-right text-sm text-texto">
          {moeda(d.liqOsg)}
        </td>
        <td className="tabular py-3 pr-5 text-right text-sm font-medium text-texto">
          {execucao !== null ? percentual(execucao) : "—"}
        </td>
      </tr>

      {aberta ? (
        <tr className="border-b border-borda bg-superficie-2/30">
          <td />
          <td colSpan={6} className="px-0 py-4 pr-5">
            <div className="mb-3 flex flex-wrap items-center gap-x-6 gap-y-1 text-xs text-texto-3">
              <span>
                <span className="font-medium text-texto-2">Programa: </span>
                {nomePrograma(d.programaCodigo)}
              </span>
              <span>
                <span className="font-medium text-texto-2">Unidade: </span>
                {d.orgaoNome}
              </span>
            </div>

            <ParticipacaoNaDotacao dotacao={d} peso={peso} />

            {d.entregas.some((e) => e.entrega) ? (
              <ul className="space-y-2">
                {d.entregas.map((e) => (
                  <li
                    key={e.id}
                    className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 rounded-lg bg-superficie px-3 py-2"
                  >
                    <p className="min-w-0 flex-1 text-pretty text-xs leading-relaxed text-texto-2">
                      {e.entrega || (
                        <span className="italic text-texto-3">
                          Entrega não descrita na planilha
                        </span>
                      )}
                    </p>
                    <p className="tabular shrink-0 text-xs text-texto">
                      {moeda(e.apropOsg)}
                      <span className="text-texto-3"> · liquidado </span>
                      {moeda(e.liqOsg)}
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
  const doQdd = base.origem === "qdd-orgao" || base.origem === "qdd-projeto";
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
          {base.liquidadoProjeto !== null ? (
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
    </div>
  );
}
