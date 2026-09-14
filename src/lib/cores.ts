import type { EixoSlug } from "./referencias";

/**
 * Cores dos gráficos, sempre por `var(--token)` — assim o modo escuro troca a
 * paleta sozinho, sem JavaScript.
 *
 * Regras que a paleta segue e que não devem ser afrouxadas:
 *
 *  - As séries NÃO usam o verde institucional. Cor de marca e cor de dado se
 *    confundiriam. O verde-menta de `--serie-3`, usado no planejado, é outro
 *    hue e não conflita com o `--verde` do cabeçalho.
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

/**
 * As duas medidas comparadas em todo o painel: **verde para o planejado, roxo
 * para o liquidado**.
 *
 * O roxo é o `--lilas` do projeto, e a escolha não é só estética: é a cor
 * associada ao enfrentamento à violência de gênero no estado (Prêmio Laço
 * Lilás, Decreto nº 11.603/2024). O verde é o `--serie-3`, verde-menta — não o
 * verde institucional, que a primeira regra acima continua proibindo.
 *
 * **Ressalva, medida e não estimada:** no modo claro este par separa 1,33:1 sob
 * deuteranopia e 1,01:1 sob protanopia, ou seja, quase nada. O par anterior
 * (azul `--serie-1` × verde `--serie-3`) era igualmente ruim, 1,04:1 e 1,08:1 —
 * a validação para daltonismo citada acima cobria os seis eixos, nunca este par.
 * No modo escuro ele fica bom, 3,87:1 e 3,02:1, pela diferença de luminosidade
 * entre `#199e70` e `#b193e8`.
 *
 * O que sustenta a leitura é o resto: rótulo de valor visível em todo gráfico,
 * legenda em texto, ordem fixa das barras e a tabela detalhada como alternativa.
 * Quem for trocar estas cores: meça antes, não presuma que passaram no teste.
 */
export const COR_APROPRIADO = "var(--serie-3)";
export const COR_LIQUIDADO = "var(--lilas)";

/**
 * Uma série só (magnitude pura): um hue, sem legenda.
 *
 * É o mesmo verde do planejado de propósito — os gráficos que a usam mostram
 * justamente essa medida, e a cor tem de acompanhar a entidade, não o gráfico.
 */
export const COR_UNICA = COR_APROPRIADO;

/**
 * Comparativo entre exercícios: três passos do verde do planejado, porque o que
 * se compara ali são dotações planejadas.
 *
 * A rampa vai do claro ao escuro conforme o tempo avança — convenção de escala
 * temporal, e a mesma direção da rampa de categorias. **No modo escuro a ordem
 * inverte**, porque ali quem avança é o brilho: o token cuida disso, o código
 * não precisa saber do tema.
 *
 * Medido (claro / escuro), contraste contra a superfície:
 * passo 1 → 2,74 / 2,61 · passo 2 → 4,40 / 4,24 · passo 3 → 6,81 / 7,81.
 * Separação entre vizinhos: 1→2 1,60 / 1,63 · 2→3 1,55 / 1,84.
 *
 * Os extremos são os mesmos dois tons de quando a rampa tinha dois passos, já
 * medidos e aprovados; o que entrou foi o meio. Preferido a acrescentar um passo
 * mais claro na ponta: qualquer verde mais claro que o passo 1 cai praticamente
 * em cima do `--cat-1` (separação medida de 1,00 a 1,22) e some contra a
 * superfície.
 *
 * **Semelhança conhecida e aceita:** a rosca de categorias, no mesmo bloco da
 * Visão Geral, também é uma rampa verde. Não há saída limpa — qualquer verde
 * distinto o bastante do outro passo cai perto de um degrau daquela rampa; foi
 * medido, e o passo 2 fica a 1,18 / 1,21 do `--cat-2`. O que separa as leituras
 * é cada gráfico ter cartão, título e legenda próprios dizendo o que a cor
 * significa ali.
 */
const RAMPA_EXERCICIO = [
  "var(--exercicio-1)",
  "var(--exercicio-2)",
  "var(--exercicio-3)",
] as const;

/** Quantos exercícios a rampa comporta. Além disso o gráfico corta e avisa. */
export const MAX_EXERCICIOS_COMPARADOS = RAMPA_EXERCICIO.length;

/**
 * Cores para `quantidade` exercícios em ordem cronológica.
 *
 * Pega os últimos passos da rampa, e não os primeiros: assim o exercício mais
 * recente fica sempre com o tom mais forte, tenha o gráfico dois anos ou três.
 */
export function coresDeExercicio(quantidade: number): string[] {
  return RAMPA_EXERCICIO.slice(-quantidade);
}
