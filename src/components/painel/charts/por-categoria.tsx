"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { porCategoria } from "@/lib/agregacoes";
import { corDaCategoria } from "@/lib/cores";
import { moeda, moedaCurta, percentual } from "@/lib/formato";
import { CATEGORIA_POR_NUMERO } from "@/lib/referencias";
import type { Registro } from "@/lib/types";
import { ChartCard } from "../chart-card";

/**
 * Rosca da composição por categoria. Categoria 1-2-3 é escala ordenada (do gasto
 * exclusivo ao de público misto), então a cor é uma rampa de um hue só — usar
 * três cores nominais sugeriria que são grupos independentes.
 *
 * A legenda à direita traz valor e percentual escritos: nenhuma leitura depende
 * só da cor.
 */
export function GraficoPorCategoria({ registros }: { registros: Registro[] }) {
  const fatias = porCategoria(registros);
  const total = fatias.reduce((s, f) => s + f.aprop, 0);
  const dados = fatias.map((f) => ({
    numero: Number(f.chave),
    rotulo: f.rotulo,
    valor: f.aprop,
    liq: f.liq,
  }));

  return (
    <ChartCard
      titulo="Composição por categoria"
      subtitulo="A categoria define quanto de cada dotação é apropriado ao OSG: integral, discriminado pelo órgão ou metade."
      alturaMinima="min-h-[260px]"
    >
      <div className="grid h-full grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="relative h-full min-h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={dados}
                dataKey="valor"
                nameKey="rotulo"
                innerRadius="58%"
                outerRadius="88%"
                paddingAngle={2}
                stroke="var(--superficie)"
                strokeWidth={2}
                // Sem animação de entrada: além de não acrescentar leitura, a
                // animação da rosca no Recharts 3 deixa os setores vazios em
                // renderizações sem tela (impressão, captura, pré-render).
                isAnimationActive={false}
              >
                {dados.map((d) => (
                  <Cell key={d.numero} fill={corDaCategoria(d.numero)} />
                ))}
              </Pie>
              <Tooltip content={<TooltipCategoria total={total} />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-[11px] uppercase tracking-wide text-texto-3">
              Planejado
            </span>
            <span className="tabular text-base font-semibold text-texto">
              {moedaCurta(total)}
            </span>
          </div>
        </div>

        <ul className="flex flex-col justify-center space-y-2.5">
          {dados.map((d) => {
            const cat = CATEGORIA_POR_NUMERO.get(d.numero as 1 | 2 | 3);
            const parte = total ? (d.valor / total) * 100 : 0;
            return (
              <li key={d.numero} className="flex items-start gap-2.5">
                <span
                  className="mt-1 size-2.5 shrink-0 rounded-sm"
                  style={{ background: corDaCategoria(d.numero) }}
                  aria-hidden
                />
                <div className="min-w-0">
                  <p className="text-xs font-medium text-texto">
                    Categoria {d.numero}
                    {cat ? (
                      <span className="font-normal text-texto-3"> · {cat.regra}</span>
                    ) : null}
                  </p>
                  <p className="tabular text-xs text-texto-2">
                    {moedaCurta(d.valor)} · {percentual(parte)}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </ChartCard>
  );
}

function TooltipCategoria({
  active,
  payload,
  total,
}: {
  active?: boolean;
  payload?: { payload?: { numero: number; valor: number; liq: number } }[];
  total: number;
}) {
  const d = payload?.[0]?.payload;
  if (!active || !d) return null;
  const cat = CATEGORIA_POR_NUMERO.get(d.numero as 1 | 2 | 3);
  return (
    <div className="max-w-xs rounded-lg border border-borda bg-superficie p-3 shadow-card-alta">
      <p className="text-xs font-semibold text-texto">
        Categoria {d.numero} — {cat?.titulo}
      </p>
      <p className="tabular mt-1.5 text-xs text-texto-2">
        Planejado: {moeda(d.valor)}
      </p>
      <p className="tabular text-xs text-texto-2">Liquidado: {moeda(d.liq)}</p>
      <p className="mt-1 text-xs text-texto-3">
        {percentual(total ? (d.valor / total) * 100 : 0)} do OSG no recorte
      </p>
      {cat ? (
        <p className="mt-2 border-t border-borda pt-2 text-xs leading-relaxed text-texto-3">
          {cat.descricao}
        </p>
      ) : null}
    </div>
  );
}
