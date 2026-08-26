"use client";

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
import type { Fatia } from "@/lib/agregacoes";
import { COR_UNICA } from "@/lib/cores";
import { moeda, moedaCurta, percentual } from "@/lib/formato";
import { ChartCard } from "../chart-card";

/**
 * Barras horizontais de série única — magnitude pura, um hue só e sem legenda
 * (o título já nomeia a série). Usado para função orçamentária e para as
 * unidades executoras.
 */
export function BarrasSimples({
  titulo,
  subtitulo,
  fatias,
  alturaMinima = "min-h-[360px]",
  larguraRotulo = 150,
}: {
  titulo: string;
  subtitulo?: string;
  fatias: Fatia[];
  alturaMinima?: string;
  larguraRotulo?: number;
}) {
  if (!fatias.length) {
    return (
      <ChartCard titulo={titulo} subtitulo={subtitulo} alturaMinima={alturaMinima}>
        <p className="flex h-full items-center justify-center text-sm text-texto-3">
          Sem dados no recorte atual.
        </p>
      </ChartCard>
    );
  }

  return (
    <ChartCard titulo={titulo} subtitulo={subtitulo} alturaMinima={alturaMinima}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={fatias}
          layout="vertical"
          margin={{ top: 4, right: 96, bottom: 4, left: 4 }}
        >
          <CartesianGrid horizontal={false} strokeDasharray="2 4" />
          <XAxis type="number" tickFormatter={moedaCurta} tickLine={false} fontSize={11} />
          <YAxis
            type="category"
            dataKey="rotulo"
            width={larguraRotulo}
            tickLine={false}
            axisLine={false}
            fontSize={11}
            interval={0}
          />
          <Tooltip cursor={{ fill: "var(--superficie-2)" }} content={<TooltipFatia />} />
          <Bar dataKey="aprop" name="Planejado" fill={COR_UNICA} radius={[0, 4, 4, 0]} barSize={13}>
            <LabelList
              dataKey="aprop"
              position="right"
              formatter={(v) => (Number(v) ? moedaCurta(Number(v)) : "")}
              className="tabular"
              fill="var(--texto-2)"
              fontSize={11}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

function TooltipFatia({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload?: Fatia }[];
}) {
  const d = payload?.[0]?.payload;
  if (!active || !d) return null;
  return (
    <div className="max-w-xs rounded-lg border border-borda bg-superficie p-3 shadow-card-alta">
      <p className="text-xs font-semibold text-texto">{d.rotulo}</p>
      <p className="tabular mt-1.5 text-xs text-texto-2">Planejado: {moeda(d.aprop)}</p>
      <p className="tabular text-xs text-texto-2">Liquidado: {moeda(d.liq)}</p>
      {d.execucao !== null ? (
        <p className="mt-1 text-xs text-texto-3">
          Execução: {percentual(d.execucao)}
        </p>
      ) : null}
    </div>
  );
}
