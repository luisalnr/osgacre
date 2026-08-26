"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { porAno } from "@/lib/agregacoes";
import { COR_APROPRIADO, COR_LIQUIDADO } from "@/lib/cores";
import { moedaCurta } from "@/lib/formato";
import type { Registro } from "@/lib/types";
import { ChartCard, Legenda, TooltipMoeda } from "../chart-card";

/**
 * Comparativo entre exercícios. É o único gráfico que ignora o filtro de ano —
 * comparar anos é justamente o ponto — mas respeita os demais filtros, então
 * "evolução do eixo Saúde" continua funcionando.
 */
export function GraficoEvolucao({ registros }: { registros: Registro[] }) {
  const fatias = porAno(registros);
  const dados = fatias.map((f) => ({
    ano: f.rotulo,
    aprop: f.aprop,
    liq: f.liq,
  }));

  return (
    <ChartCard
      titulo="Evolução entre exercícios"
      subtitulo="Ignora o filtro de exercício e mantém os demais. Cada ano tem sua própria lei orçamentária, por isso os valores não se somam."
      alturaMinima="min-h-[280px]"
      legenda={
        <Legenda
          itens={[
            { cor: COR_APROPRIADO, rotulo: "Planejado" },
            { cor: COR_LIQUIDADO, rotulo: "Liquidado" },
          ]}
        />
      }
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={dados} margin={{ top: 12, right: 8, bottom: 4, left: 8 }} barGap={2}>
          <CartesianGrid vertical={false} strokeDasharray="2 4" />
          <XAxis dataKey="ano" tickLine={false} axisLine={false} fontSize={12} />
          <YAxis tickFormatter={moedaCurta} tickLine={false} axisLine={false} fontSize={11} width={86} />
          <Tooltip cursor={{ fill: "var(--superficie-2)" }} content={<TooltipMoeda />} />
          <Bar
            dataKey="aprop"
            name="Planejado"
            fill={COR_APROPRIADO}
            radius={[4, 4, 0, 0]}
            barSize={40}
          />
          <Bar
            dataKey="liq"
            name="Liquidado"
            fill={COR_LIQUIDADO}
            radius={[4, 4, 0, 0]}
            barSize={40}
          />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
