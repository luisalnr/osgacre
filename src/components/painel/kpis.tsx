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
import { Barra, Card } from "@/components/ui/primitivos";

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
  const varLiq = anterior ? variacao(totais.liq, anterior.liq) : null;
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
      <Kpi
        icone={Receipt}
        rotulo="Liquidado OSG"
        valor={moedaCurta(totais.liq)}
        titulo={moeda(totais.liq)}
        nota={
          varLiq !== null && anoAnterior
            ? `${sinal(varLiq)}${percentual(varLiq)} sobre ${anoAnterior}`
            : "Executado no exercício"
        }
      />
      <Kpi
        icone={TrendingUp}
        rotulo="Execução"
        valor={totais.execucao !== null ? percentual(totais.execucao) : "—"}
        progresso={totais.execucao}
        nota={
          varExec !== null && anoAnterior
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
        nota="Unidades com valor planejado no OSG"
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
  progresso,
}: {
  icone: LucideIcon;
  rotulo: string;
  valor: string;
  titulo?: string;
  nota?: string;
  progresso?: number | null;
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
      {progresso !== undefined && progresso !== null ? (
        <Barra
          valor={progresso}
          cor={progresso >= 70 ? "var(--bom)" : progresso >= 40 ? "var(--alerta)" : "var(--critico)"}
          className="mt-3"
        />
      ) : null}
      {nota ? <p className="mt-2 text-xs text-texto-3">{nota}</p> : null}
    </Card>
  );
}
