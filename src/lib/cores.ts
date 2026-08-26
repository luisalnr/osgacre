import type { EixoSlug } from "./referencias";

/**
 * Cores dos gráficos, sempre por `var(--token)` — assim o modo escuro troca a
 * paleta sozinho, sem JavaScript.
 *
 * Regras que a paleta segue e que não devem ser afrouxadas:
 *
 *  - As séries NÃO usam o verde institucional. Cor de marca e cor de dado se
 *    confundiriam.
 *  - A cor acompanha a entidade, nunca a posição no ranking: filtrar eixos não
 *    pode repintar os que sobraram.
 *  - Os gráficos por eixo ficam na ordem canônica da Lei nº 4.168/2023 (I a VI),
 *    e não ordenados por valor. Isso não é só fidelidade à lei: a separação para
 *    daltonismo foi validada para pares vizinhos nessa ordem, e reordenar por
 *    valor colocaria lado a lado combinações que não passaram no teste.
 *  - Categoria 1-2-3 é escala ordenada, então usa uma rampa de um hue só, não
 *    seis cores nominais.
 *  - No modo claro três das seis séries ficam abaixo de 3:1 contra a superfície:
 *    todo gráfico traz rótulo de valor visível, e a tabela detalhada é a leitura
 *    alternativa.
 */

export const COR_EIXO: Record<EixoSlug, string> = {
  "assistencia-social": "var(--serie-1)",
  educacao: "var(--serie-2)",
  saude: "var(--serie-3)",
  seguranca: "var(--serie-4)",
  economico: "var(--serie-5)",
  governanca: "var(--serie-6)",
};

export const corDoEixo = (slug: string): string =>
  COR_EIXO[slug as EixoSlug] ?? "var(--texto-3)";

/** Rampa ordinal das categorias. */
export const COR_CATEGORIA: Record<number, string> = {
  1: "var(--cat-1)",
  2: "var(--cat-2)",
  3: "var(--cat-3)",
};

export const corDaCategoria = (n: number): string =>
  COR_CATEGORIA[n] ?? "var(--texto-3)";

/** As duas medidas comparadas em todo o painel. */
export const COR_APROPRIADO = "var(--serie-1)";
export const COR_LIQUIDADO = "var(--serie-3)";

/** Uma série só (magnitude pura): um hue, sem legenda. */
export const COR_UNICA = "var(--serie-1)";
