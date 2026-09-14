"use client";

import { useMemo, useState } from "react";

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
import { dotacoesPorEixoEAno } from "@/lib/agregacoes";
import { MAX_EXERCICIOS_COMPARADOS, coresDeExercicio } from "@/lib/cores";
import { percentual, sinal, variacao } from "@/lib/formato";
import { EIXOS, nomeEixo } from "@/lib/referencias";
import type { Registro } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ChartCard, Legenda } from "../chart-card";

/**
 * Quantas dotações cada eixo teve em cada exercício.
 *
 * Ignora o filtro de exercício — comparar exercícios é o ponto — e respeita os
 * demais, como faz o gráfico de evolução.
 *
 * **A cor identifica o EXERCÍCIO, num só matiz.** São dotações planejadas, e
 * planejado é verde no painel — então os anos são passos do mesmo verde, do
 * claro ao escuro conforme o tempo avança. O eixo já está escrito no rótulo do
 * eixo Y e não precisa de cor.
 *
 * Chegou a colorir por eixo, com seis matizes e o ano anterior em contorno: o
 * cartão competia com os gráficos vizinhos e o contorno parecia falha de
 * renderização. Ver `coresDeExercicio` em `cores.ts` para os tons medidos.
 *
 * A rampa comporta `MAX_EXERCICIOS_COMPARADOS` anos. Passando disso o gráfico
 * mostra os mais recentes e **diz no subtítulo** que cortou: até 2026 ele
 * escondia um exercício calado, que é o defeito que esta regra existe para não
 * repetir.
 */
export function GraficoDotacoesPorEixo({ registros }: { registros: Registro[] }) {
  const [mostrarVariacao, setMostrarVariacao] = useState(false);
  const { anos, porEixo } = useMemo(
    () => dotacoesPorEixoEAno(registros),
    [registros]
  );

  const exibidos = useMemo(
    () => anos.slice(-MAX_EXERCICIOS_COMPARADOS),
    [anos]
  );
  const cores = coresDeExercicio(exibidos.length);
  const omitidos = anos.length - exibidos.length;

  // Ordem canônica da Lei nº 4.168/2023, como nos demais gráficos por eixo.
  // O rótulo de cada barra sai pronto daqui, com a variação já embutida: deixar
  // o formatter da LabelList procurar o ano anterior o obrigaria a conhecer a
  // linha inteira, que ele não recebe.
  const dados = useMemo(
    () =>
      EIXOS.map((e) => {
        const contagens = porEixo.get(e.slug);
        const linha: Record<string, string | number> = {
          chave: e.slug,
          rotulo: e.curto,
        };
        exibidos.forEach((ano, i) => {
          const atual = contagens?.get(ano) ?? 0;
          linha[`a${ano}`] = atual;

          const anterior = i > 0 ? (contagens?.get(exibidos[i - 1]) ?? 0) : null;
          const texto = textoVariacao(atual, anterior);
          linha[`v${ano}`] = texto ?? "";
          // Barra zerada não ganha rótulo: um "0" solto em cada eixo vazio
          // sujava o gráfico sem informar nada.
          linha[`r${ano}`] = !atual
            ? ""
            : mostrarVariacao && texto
              ? `${atual}  ${texto}`
              : String(atual);
        });
        return linha;
      }),
    [porEixo, exibidos, mostrarVariacao]
  );

  if (exibidos.length < 2) {
    return (
      <ChartCard
        titulo="Dotações por eixo entre exercícios"
        subtitulo="Comparativo indisponível: há apenas um exercício carregado."
        alturaMinima="min-h-[300px]"
      >
        <div className="flex h-full items-center justify-center text-sm text-texto-3">
          É preciso mais de um exercício para comparar.
        </div>
      </ChartCard>
    );
  }

  return (
    <ChartCard
      titulo="Dotações por eixo entre exercícios"
      subtitulo={
        "Quantas dotações cada eixo reuniu em cada exercício. Ignora o filtro de exercício e mantém os demais." +
        (omitidos > 0
          ? ` Mostra os ${exibidos.length} exercícios mais recentes; ${omitidos === 1 ? "um exercício mais antigo ficou de fora" : `${omitidos} exercícios mais antigos ficaram de fora`}.`
          : "")
      }
      alturaMinima="min-h-[430px]"
      legenda={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Legenda
            itens={exibidos.map((ano, i) => ({
              cor: cores[i],
              rotulo: String(ano),
            }))}
          />
          <button
            type="button"
            role="switch"
            aria-checked={mostrarVariacao}
            aria-label="Mostrar variação anual de dotações no gráfico"
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
        </div>
      }
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={dados}
          layout="vertical"
          // O rótulo cresce com a variação ligada ("57 +26 (+84%)"), e sem
          // margem extra ele encosta na borda do cartão e some.
          margin={{ top: 4, right: mostrarVariacao ? 124 : 40, bottom: 4, left: 4 }}
          barGap={2}
          barCategoryGap="28%"
        >
          <CartesianGrid horizontal={false} strokeDasharray="2 4" />
          <XAxis type="number" allowDecimals={false} tickLine={false} fontSize={11} />
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
            content={<TooltipContagem mostrarVariacao={mostrarVariacao} />}
          />
          {exibidos.map((ano, i) => {
            const cheio = i === exibidos.length - 1;
            return (
              <Bar
                key={ano}
                dataKey={`a${ano}`}
                name={String(ano)}
                fill={cores[i]}
                radius={[0, 4, 4, 0]}
                maxBarSize={16}
              >
                <LabelList
                  dataKey={`r${ano}`}
                  position="right"
                  className="tabular"
                  fill={cheio ? "var(--texto-2)" : "var(--texto-3)"}
                  fontSize={11}
                />
              </Bar>
            );
          })}
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

/**
 * Variação de um exercício para o seguinte, no mesmo eixo.
 *
 * `null` quando não há com o que comparar: o exercício mais antigo exibido não
 * tem base. Sobre base zero sai só o absoluto — um eixo que não existia no ano
 * anterior não teve aumento percentual, teve estreia, e `variacao` devolve
 * `null` justamente aí.
 */
function textoVariacao(atual: number, anterior: number | null): string | null {
  if (anterior === null) return null;
  const delta = atual - anterior;
  // "0%" em vez de "+0": diz "não mudou" sem parecer que o toggle não pegou.
  if (delta === 0) return "0%";
  const pct = variacao(atual, anterior);
  const absoluto = `${sinal(delta)}${delta}`;
  return pct === null ? absoluto : `${absoluto} (${sinal(pct)}${percentual(pct, 0)})`;
}

/** Contagens são inteiros: nada de formatar como moeda aqui. */
function TooltipContagem({
  active,
  payload,
  mostrarVariacao,
}: {
  active?: boolean;
  payload?: {
    name?: string;
    value?: number | string;
    payload?: Record<string, string | number>;
  }[];
  mostrarVariacao?: boolean;
}) {
  if (!active || !payload?.length) return null;
  const linha = payload[0]?.payload;
  const chave = linha?.chave;
  return (
    <div className="max-w-xs rounded-lg border border-borda bg-superficie p-3 shadow-card-alta">
      {typeof chave === "string" ? (
        <p className="mb-2 text-xs font-semibold text-texto">{nomeEixo(chave)}</p>
      ) : null}
      <ul className="space-y-1">
        {payload.map((p, i) => {
          // O rótulo ao lado da barra some quando a contagem é zero e encolhe em
          // tela estreita. O tooltip é onde a variação tem de estar garantida.
          const variacaoDoAno = mostrarVariacao ? linha?.[`v${p.name}`] : "";
          return (
            <li key={i} className="flex items-center justify-between gap-4 text-xs">
              <span className="text-texto-2">{p.name}</span>
              <span className="tabular font-medium text-texto">
                {Number(p.value ?? 0)}{" "}
                {Number(p.value) === 1 ? "dotação" : "dotações"}
                {variacaoDoAno ? (
                  <span className="ml-1 font-normal text-texto-3">{variacaoDoAno}</span>
                ) : null}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
