"use client";

import type { LucideIcon } from "lucide-react";
import { Building2, Coins, Landmark, Receipt, TrendingUp } from "lucide-react";
import {
  inteiro,
  moeda,
  moedaCurta,
  percentual,
  pontosPercentuais,
  sinal,
  variacao,
} from "@/lib/formato";
import type { Totais } from "@/lib/types";
import { Card } from "@/components/ui/primitivos";

/**
 * Cinco indicadores, todos derivados só das duas colunas que o painel exibe:
 * o valor planejado e o liquidado do OSG. O comparativo com o exercício anterior fica
 * ao lado do número — sem ele, um valor absoluto não diz se subiu ou caiu.
 */
export function Kpis({
  totais,
  anterior,
  anoAnterior,
}: {
  totais: Totais;
  anterior: Totais | null;
  anoAnterior: number | null;
}) {
  const varAprop = anterior ? variacao(totais.aprop, anterior.aprop) : null;
  const varLiq =
    anterior && totais.liq !== null && anterior.liq !== null
      ? variacao(totais.liq, anterior.liq)
      : null;
  const varExec =
    anterior && anterior.execucao !== null && totais.execucao !== null
      ? totais.execucao - anterior.execucao
      : null;

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      <Kpi
        icone={Coins}
        rotulo="Valor planejado OSG"
        valor={moedaCurta(totais.aprop)}
        titulo={moeda(totais.aprop)}
        nota={
          varAprop !== null && anoAnterior
            ? `${sinal(varAprop)}${percentual(varAprop)} sobre ${anoAnterior}`
            : "Planejado no exercício"
        }
      />
      {/*
        Em exercício de execução ainda aberta os dois cartões continuam na tela,
        vazios e com a nota que explica por quê. Retirá-los mudaria a grade de
        cinco para três colunas e faria o painel de 2026 parecer um painel
        diferente do de 2025 — quem compara exercícios precisa reconhecer a mesma
        tela, com a informação que falta assinalada em vez de ausente.
      */}
      <Kpi
        icone={Receipt}
        rotulo="Liquidado OSG"
        valor={totais.liq !== null ? moedaCurta(totais.liq) : "—"}
        titulo={totais.liq !== null ? moeda(totais.liq) : undefined}
        nota={
          totais.emApuracao
            ? "Exercício em apuração"
            : varLiq !== null && anoAnterior
              ? `${sinal(varLiq)}${percentual(varLiq)} sobre ${anoAnterior}`
              : "Executado no exercício"
        }
      />
      <Kpi
        icone={TrendingUp}
        rotulo="Execução"
        valor={totais.execucao !== null ? percentual(totais.execucao) : "—"}
        nota={
          totais.emApuracao
            ? "Exercício em apuração"
            : varExec !== null && anoAnterior
              ? `${pontosPercentuais(varExec)} sobre ${anoAnterior}`
              : "Liquidado sobre o planejado"
        }
      />
      <Kpi
        icone={Landmark}
        rotulo="Dotações"
        valor={inteiro(totais.dotacoes)}
        nota={`${inteiro(totais.entregas)} entregas apropriadas`}
      />
      <Kpi
        icone={Building2}
        rotulo="Órgãos executores"
        valor={inteiro(totais.orgaos)}
        nota={`${inteiro(totais.unidades)} unidades orçamentárias`}
      />
    </div>
  );
}

function Kpi({
  icone: Icone,
  rotulo,
  valor,
  titulo,
  nota,
}: {
  icone: LucideIcon;
  rotulo: string;
  valor: string;
  titulo?: string;
  nota?: string;
}) {
  return (
    <Card className="relative overflow-hidden p-4">
      <Icone
        className="pointer-events-none absolute -right-2 -top-2 size-16 text-texto opacity-[0.04]"
        aria-hidden
      />
      <p className="text-xs font-medium uppercase tracking-wide text-texto-3">
        {rotulo}
      </p>
      <p className="tabular mt-1.5 text-2xl font-semibold text-texto" title={titulo}>
        {valor}
      </p>
      {nota ? <p className="mt-2 text-xs text-texto-3">{nota}</p> : null}
    </Card>
  );
}
