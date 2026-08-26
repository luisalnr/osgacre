"use client";

import type { ReactNode } from "react";
import { Card } from "@/components/ui/primitivos";
import { moeda, percentual } from "@/lib/formato";
import { cn } from "@/lib/utils";

/**
 * Moldura dos gráficos. O `relative` + `absolute inset-0` existe porque o
 * ResponsiveContainer do Recharts com height="100%" precisa de um pai com altura
 * concreta; sem isso o gráfico colapsa para zero.
 */
export function ChartCard({
  titulo,
  subtitulo,
  alturaMinima = "min-h-[320px]",
  legenda,
  children,
  className,
}: {
  titulo: string;
  subtitulo?: string;
  /** Piso de altura da área do gráfico. Precisa ser min-h, não h: com `flex-1`
   *  o flex-basis 0 anularia uma altura fixa e o gráfico colapsaria. */
  alturaMinima?: string;
  legenda?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("flex flex-col p-5", className)}>
      <header className="mb-4">
        <h3 className="text-sm font-semibold text-texto">{titulo}</h3>
        {subtitulo ? (
          <p className="mt-1 text-xs leading-relaxed text-texto-3">{subtitulo}</p>
        ) : null}
      </header>
      {legenda ? <div className="mb-3">{legenda}</div> : null}
      <div className={cn("relative w-full flex-1", alturaMinima)}>
        <div className="absolute inset-0">{children}</div>
      </div>
    </Card>
  );
}

/** Legenda textual: identidade nunca fica só na cor. */
export function Legenda({
  itens,
}: {
  itens: { cor: string; rotulo: string }[];
}) {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
      {itens.map((i) => (
        <li key={i.rotulo} className="flex items-center gap-1.5">
          <span
            className="size-2.5 shrink-0 rounded-sm"
            style={{ background: i.cor }}
            aria-hidden
          />
          <span className="text-xs text-texto-2">{i.rotulo}</span>
        </li>
      ))}
    </ul>
  );
}

export type ItemTooltip = {
  name?: string;
  value?: number | string;
  color?: string;
  dataKey?: string | number;
  payload?: Record<string, unknown>;
};

/** Tooltip padrão: valores em reais, com o percentual de execução quando cabe. */
export function TooltipMoeda({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: ItemTooltip[];
  label?: string | number;
}) {
  if (!active || !payload?.length) return null;

  const aprop = Number(payload.find((p) => p.dataKey === "aprop")?.value ?? 0);
  const liq = Number(payload.find((p) => p.dataKey === "liq")?.value ?? 0);
  const mostrarExecucao = aprop > 0 && payload.length > 1;

  return (
    <div className="max-w-xs rounded-lg border border-borda bg-superficie p-3 shadow-card-alta">
      {label !== undefined ? (
        <p className="mb-2 text-xs font-semibold text-texto">{label}</p>
      ) : null}
      <ul className="space-y-1">
        {payload.map((p, i) => (
          <li key={i} className="flex items-center justify-between gap-4 text-xs">
            <span className="flex items-center gap-1.5 text-texto-2">
              <span
                className="size-2 rounded-sm"
                style={{ background: p.color }}
                aria-hidden
              />
              {p.name}
            </span>
            <span className="tabular font-medium text-texto">
              {moeda(Number(p.value ?? 0))}
            </span>
          </li>
        ))}
      </ul>
      {mostrarExecucao ? (
        <p className="mt-2 border-t border-borda pt-2 text-xs text-texto-3">
          Execução: {percentual((liq / aprop) * 100)}
        </p>
      ) : null}
    </div>
  );
}
