"use client";

import { memo, useMemo, useState } from "react";

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type LineDrawShapeProps,
} from "recharts";
import { porAno } from "@/lib/agregacoes";
import { COR_APROPRIADO, COR_LIQUIDADO } from "@/lib/cores";
import { moedaCurta, percentual, sinal, variacao } from "@/lib/formato";
import type { Registro } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ChartCard, Legenda, TooltipMoeda } from "../chart-card";

/**
 * Comparativo entre exercícios. É o único gráfico que ignora o filtro de ano —
 * comparar anos é justamente o ponto — mas respeita os demais filtros, então
 * "evolução do eixo Saúde" continua funcionando.
 */
export const GraficoEvolucao = memo(function GraficoEvolucao({
  registros,
}: {
  registros: Registro[];
}) {
  const dados = useMemo(
    () =>
      porAno(registros).map((f) => ({
        ano: f.rotulo,
        aprop: f.aprop,
        // `null` no exercício em apuração: o Recharts não desenha a barra, que é
        // exatamente a leitura certa — o planejado do ano aparece e o liquidado
        // fica em branco, sem sugerir uma execução que despencou.
        liq: f.liq,
        emApuracao: f.emApuracao,
      })),
    [registros]
  );
  const [mostrarVariacao, setMostrarVariacao] = useState(false);
  const apurando = dados.filter((d) => d.emApuracao).map((d) => d.ano);

  return (
    <ChartCard
      titulo="Evolução entre exercícios"
      subtitulo={
        "Ignora o filtro de exercício e mantém os demais. Cada ano tem sua própria " +
        "lei orçamentária, por isso os valores não se somam." +
        (apurando.length
          ? ` Sem liquidado em ${apurando.join(" e ")}: a execução ainda não foi encerrada.`
          : "")
      }
      alturaMinima="min-h-[280px]"
      legenda={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Legenda
            itens={[
              { cor: COR_APROPRIADO, rotulo: "Planejado" },
              { cor: COR_LIQUIDADO, rotulo: "Liquidado" },
            ]}
          />
          {dados.length > 1 ? (
            <button
              type="button"
              role="switch"
              aria-checked={mostrarVariacao}
              aria-label="Mostrar variação percentual anual no gráfico"
              onClick={() => setMostrarVariacao((valor) => !valor)}
              className="inline-flex items-center gap-2 text-xs font-medium text-texto-2 transition-colors hover:text-texto"
            >
              Variação anual
              <span
                className={cn(
                  "flex h-5 w-10 shrink-0 rounded-full p-0.5 transition-colors",
                  mostrarVariacao ? "bg-lilas" : "bg-borda-forte"
                )}
                aria-hidden
              >
                <span
                  className={cn(
                    "size-4 rounded-full bg-white shadow-sm transition-[margin]",
                    mostrarVariacao && "ml-auto"
                  )}
                />
              </span>
            </button>
          ) : null}
        </div>
      }
    >
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={dados}
          margin={{ top: 12, right: 8, bottom: 4, left: 8 }}
          barGap={2}
        >
          <CartesianGrid vertical={false} strokeDasharray="2 4" />
          <XAxis dataKey="ano" tickLine={false} axisLine={false} fontSize={12} />
          <YAxis tickFormatter={moedaCurta} tickLine={false} axisLine={false} fontSize={11} width={86} />
          <Tooltip cursor={{ fill: "var(--superficie-2)" }} content={<TooltipMoeda />} />
          {/* Sem animação, como as linhas de variação logo abaixo: as barras
              ficavam 1,5 s crescendo a cada troca de filtro ou de seção. */}
          <Bar
            dataKey="aprop"
            name="Planejado"
            fill={COR_APROPRIADO}
            radius={[4, 4, 0, 0]}
            barSize={40}
            isAnimationActive={false}
          />
          <Bar
            dataKey="liq"
            name="Liquidado"
            fill={COR_LIQUIDADO}
            radius={[4, 4, 0, 0]}
            barSize={40}
            isAnimationActive={false}
          />
          {mostrarVariacao ? (
            <>
              <Line
                dataKey="aprop"
                name="Planejado"
                stroke={COR_APROPRIADO}
                dot={false}
                activeDot={false}
                legendType="none"
                tooltipType="none"
                isAnimationActive={false}
                zIndex={500}
                shape={(props) => (
                  <FormaLinhaVariacao
                    {...props}
                    dados={dados}
                    chave="aprop"
                    cor={COR_APROPRIADO}
                    rotulo="Planejado"
                    deslocamentoX={-(TAMANHO_BARRA + ESPACO_ENTRE_BARRAS) / 2}
                    ajusteRotulo={-10}
                  />
                )}
              />
              <Line
                dataKey="liq"
                name="Liquidado"
                stroke={COR_LIQUIDADO}
                dot={false}
                activeDot={false}
                legendType="none"
                tooltipType="none"
                isAnimationActive={false}
                zIndex={500}
                shape={(props) => (
                  <FormaLinhaVariacao
                    {...props}
                    dados={dados}
                    chave="liq"
                    cor={COR_LIQUIDADO}
                    rotulo="Liquidado"
                    deslocamentoX={(TAMANHO_BARRA + ESPACO_ENTRE_BARRAS) / 2}
                    ajusteRotulo={14}
                  />
                )}
              />
            </>
          ) : null}
        </ComposedChart>
      </ResponsiveContainer>
    </ChartCard>
  );
});

const TAMANHO_BARRA = 40;
const ESPACO_ENTRE_BARRAS = 2;

/**
 * Forma de uma série `Line` do Recharts. Os pontos já chegam alinhados ao centro
 * de cada exercício; o deslocamento horizontal leva a série até o centro exato
 * de sua barra. Assim a linha continua nativa do gráfico e acompanha o resize.
 */
function FormaLinhaVariacao({
  points,
  dados,
  chave,
  cor,
  rotulo,
  deslocamentoX,
  ajusteRotulo,
}: {
  points?: LineDrawShapeProps["points"];
  dados: { ano: string; aprop: number; liq: number | null }[];
  chave: "aprop" | "liq";
  cor: string;
  rotulo: string;
  deslocamentoX: number;
  ajusteRotulo: number;
}) {
  if (!points || points.length < 2) return null;

  return (
    <g aria-hidden="true" className="pointer-events-none">
      {points.slice(1).map((pontoAtual, indice) => {
        const pontoAnterior = points[indice];
        const anterior = dados[indice];
        const atual = dados[indice + 1];
        if (
          pontoAnterior.x === null ||
          pontoAnterior.y === null ||
          pontoAtual.x === null ||
          pontoAtual.y === null ||
          !anterior ||
          !atual
        )
          return null;

        // Sem valor num dos extremos não há variação a traçar. É o que faz o
        // trecho 2025→2026 do liquidado simplesmente não existir, em vez de
        // virar uma queda de 100% para um exercício que ainda está executando.
        const valorAnterior = anterior[chave];
        const valorAtual = atual[chave];
        if (valorAnterior === null || valorAtual === null) return null;

        const x1 = pontoAnterior.x + deslocamentoX;
        const x2 = pontoAtual.x + deslocamentoX;
        const percentualAnual = variacao(valorAtual, valorAnterior);
        const texto =
          percentualAnual === null
            ? "sem base"
            : `${sinal(percentualAnual)}${percentual(percentualAnual)}`;
        const meioX = (x1 + x2) / 2;
        const meioY = (pontoAnterior.y + pontoAtual.y) / 2 + ajusteRotulo;

        return (
          <g key={`${chave}-${atual.ano}`}>
            <title>{`${rotulo}: ${texto} em ${atual.ano} em relação a ${anterior.ano}`}</title>
            <line
              x1={x1}
              y1={pontoAnterior.y}
              x2={x2}
              y2={pontoAtual.y}
              stroke={cor}
              strokeWidth={2}
              strokeDasharray="6 4"
              opacity={0.95}
            />
            <circle cx={x1} cy={pontoAnterior.y} r={3} fill={cor} />
            <circle cx={x2} cy={pontoAtual.y} r={3} fill={cor} />
            <text
              x={meioX}
              y={meioY}
              textAnchor="middle"
              dominantBaseline="middle"
              fill={cor}
              fontSize={12}
              fontWeight={700}
              paintOrder="stroke"
              stroke="var(--superficie)"
              strokeWidth={5}
            >
              {texto}
            </text>
          </g>
        );
      })}
    </g>
  );
}
