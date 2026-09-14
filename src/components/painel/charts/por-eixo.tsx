"use client";

import { memo, useMemo } from "react";

import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { porEixo } from "@/lib/agregacoes";
import { COR_APROPRIADO, COR_LIQUIDADO } from "@/lib/cores";
import { moedaCurta } from "@/lib/formato";
import { EIXOS, nomeEixo } from "@/lib/referencias";
import type { Registro } from "@/lib/types";
import { ChartCard, Legenda, TooltipMoeda, type ItemTooltip } from "../chart-card";

/**
 * Barras agrupadas por eixo, na ordem da Lei nº 4.168/2023 (I a VI) e não por
 * valor: a cor de cada eixo precisa ser estável e a validação de separação para
 * daltonismo foi feita nessa sequência de vizinhos.
 *
 * A cor aqui identifica a MEDIDA (planejado x liquidado), não o eixo — o eixo
 * já está escrito no rótulo do eixo Y.
 */
export const GraficoPorEixo = memo(function GraficoPorEixo({
  registros,
}: {
  registros: Registro[];
}) {
  // `memo` mais `useMemo`: sem eles, qualquer estado do painel — recolher a
  // barra lateral, abrir uma linha da tabela — refazia esta agregação e toda a
  // árvore do Recharts.
  const { dados, apurando } = useMemo(() => {
    const fatias = porEixo(registros);
    const porChave = new Map(fatias.map((f) => [f.chave, f]));
    return {
      dados: EIXOS.map((e) => {
        const f = porChave.get(e.slug);
        return {
          chave: e.slug,
          rotulo: e.curto,
          nome: e.nome,
          aprop: f?.aprop ?? 0,
          liq: f?.liq ?? 0,
        };
      }),
      // Com a execução do exercício ainda aberta o gráfico vira de barra única.
      // Manter a segunda barra zerada seria pior do que retirá-la: uma barra de
      // liquidado encostada no eixo lê-se como "não executou nada", que é o
      // oposto do que se sabe.
      apurando: fatias.length > 0 && fatias.every((f) => f.emApuracao),
    };
  }, [registros]);

  return (
    <ChartCard
      titulo={apurando ? "Valor planejado por eixo temático" : "Execução por eixo temático"}
      subtitulo={
        apurando
          ? "Valor planejado do OSG em cada eixo, na ordem definida pela Lei nº 4.168/2023. O liquidado não é exibido enquanto a execução do exercício não for encerrada."
          : "Valor planejado do OSG e valor liquidado em cada eixo, na ordem definida pela Lei nº 4.168/2023."
      }
      alturaMinima="min-h-[360px]"
      legenda={
        <Legenda
          itens={
            apurando
              ? [{ cor: COR_APROPRIADO, rotulo: "Planejado" }]
              : [
                  { cor: COR_APROPRIADO, rotulo: "Planejado" },
                  { cor: COR_LIQUIDADO, rotulo: "Liquidado" },
                ]
          }
        />
      }
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={dados}
          layout="vertical"
          // margem à direita generosa: sem ela o rótulo de valor quebra em duas linhas
          margin={{ top: 4, right: 96, bottom: 4, left: 4 }}
          barGap={2}
          barCategoryGap="28%"
        >
          <CartesianGrid horizontal={false} strokeDasharray="2 4" />
          <XAxis type="number" tickFormatter={moedaCurta} tickLine={false} fontSize={11} />
          <YAxis
            type="category"
            dataKey="rotulo"
            width={126}
            tickLine={false}
            axisLine={false}
            fontSize={12}
          />
          <Tooltip
            cursor={{ fill: "var(--superficie-2)" }}
            content={<TooltipConteudo />}
          />
          {/* `isAnimationActive={false}` nas duas séries: a animação de 1,5 s do
              Recharts é o que faz o clique na barra lateral parecer travado. */}
          <Bar
            dataKey="aprop"
            name="Planejado"
            fill={COR_APROPRIADO}
            radius={[0, 4, 4, 0]}
            maxBarSize={16}
            isAnimationActive={false}
          >
            <LabelList
              dataKey="aprop"
              position="right"
              formatter={(v) => (Number(v) ? moedaCurta(Number(v)) : "")}
              className="tabular"
              fill="var(--texto-2)"
              fontSize={11}
            />
          </Bar>
          {apurando ? null : (
            <Bar
              dataKey="liq"
              name="Liquidado"
              fill={COR_LIQUIDADO}
              radius={[0, 4, 4, 0]}
              maxBarSize={16}
              isAnimationActive={false}
            >
              <LabelList
                dataKey="liq"
                position="right"
                formatter={(v) => (Number(v) ? moedaCurta(Number(v)) : "")}
                className="tabular"
                fill="var(--texto-3)"
                fontSize={11}
              />
            </Bar>
          )}
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
});

/** Troca o algarismo romano pelo nome do eixo no tooltip. */
function TooltipConteudo(props: {
  active?: boolean;
  payload?: ItemTooltip[];
  label?: string;
}) {
  const chave = props.payload?.[0]?.payload?.chave;
  return (
    <TooltipMoeda
      {...props}
      label={typeof chave === "string" ? nomeEixo(chave) : props.label}
    />
  );
}
