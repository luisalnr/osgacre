const MOEDA = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const MOEDA_CURTA = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

const INTEIRO = new Intl.NumberFormat("pt-BR");

export const moeda = (v: number) => MOEDA.format(Number.isFinite(v) ? v : 0);

/** Versão compacta para eixos de gráfico e KPIs: R$ 171,1 mi. */
export function moedaCurta(v: number): string {
  const n = Number.isFinite(v) ? v : 0;
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return `R$ ${MOEDA_CURTA.format(n / 1_000_000_000)} bi`;
  if (abs >= 1_000_000) return `R$ ${MOEDA_CURTA.format(n / 1_000_000)} mi`;
  if (abs >= 1_000) return `R$ ${MOEDA_CURTA.format(n / 1_000)} mil`;
  return moeda(n);
}

export const inteiro = (v: number) => INTEIRO.format(Number.isFinite(v) ? v : 0);

export function percentual(v: number, casas = 1): string {
  if (!Number.isFinite(v)) return "—";
  return `${v.toLocaleString("pt-BR", {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  })}%`;
}

/** Razão a/b em porcentagem, protegida contra divisão por zero. */
export function razao(a: number, b: number): number | null {
  if (!b) return null;
  return (a / b) * 100;
}

/** Variação percentual de `anterior` para `atual`. */
export function variacao(atual: number, anterior: number): number | null {
  if (!anterior) return null;
  return ((atual - anterior) / Math.abs(anterior)) * 100;
}

export const sinal = (v: number) => (v > 0 ? "+" : "");

/** Diferença entre dois percentuais: é ponto percentual, não porcentagem. */
export function pontosPercentuais(v: number, casas = 1): string {
  if (!Number.isFinite(v)) return "—";
  return `${sinal(v)}${v.toLocaleString("pt-BR", {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  })} p.p.`;
}
