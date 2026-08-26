/** Um registro = uma entrega apropriada. É a granularidade da Tabela_OSG. */
export type Registro = {
  id: string;
  ano: number;
  categoria: number;
  orgaoCodigo: string;
  orgaoNome: string;
  orgaoSigla: string;
  aplicacaoProgramada: string;
  projetoAtividade: string;
  funcaoCodigo: string;
  programaCodigo: string;
  /** Slug canônico do eixo (ver `referencias.ts`). */
  eixo: string;
  entrega: string;
  apropOsg: number;
  liqOsg: number;
  orcAprovado: number;
  orcFinal: number;
  liqProjeto: number;
  aLiquidar: number;
  /**
   * Totais da dotação inteira — soma do grupo (ano, projeto/atividade), já que
   * as colunas de projeto chegam rateadas por linha. O rateio ignora o órgão,
   * então estes valores nunca podem ser recalculados dentro do recorte por órgão.
   */
  orcAprovadoProjeto: number;
  orcFinalProjeto: number;
  liqProjetoTotal: number;
};

/**
 * Uma dotação agrupa as entregas de um mesmo (ano, órgão, projeto/atividade).
 * É a unidade que o painel exibe.
 */
export type Dotacao = {
  chave: string;
  ano: number;
  orgaoCodigo: string;
  orgaoSigla: string;
  orgaoNome: string;
  aplicacaoProgramada: string;
  projetoAtividade: string;
  funcaoCodigo: string;
  programaCodigo: string;
  eixo: string;
  /** Categorias presentes nas entregas — normalmente uma só. */
  categorias: number[];
  apropOsg: number;
  liqOsg: number;
  orcAprovadoProjeto: number;
  orcFinalProjeto: number;
  entregas: Registro[];
};

/**
 * Uma dotação do QDD, agregada de (exercício, órgão, unidade, projeto/atividade).
 * `dotacaoAtualizada` é a coluna `Ini+Sup+Cor-Red (B)` — a que reflete
 * remanejamentos e a única em que as emendas parlamentares aparecem.
 */
export type DotacaoQdd = {
  id: string;
  ano: number;
  orgaoCodigo: string;
  orgaoNome: string;
  unidadeCodigo: string;
  unidadeNome: string;
  projetoAtividade: string;
  aplicacaoProgramada: string;
  funcaoProgramatica: string;
  dotacaoInicial: number;
  suplementado: number;
  dotacaoAtualizada: number;
  empenhado: number;
  liquidado: number;
  aLiquidar: number;
  pago: number;
};

export type Lei = {
  id: string;
  tipo: TipoLei;
  ordem: number;
  numero: string;
  data: string;
  doe: string;
  ementa: string;
  orgao: string;
  url: string;
  sensivelGenero: string;
  citacoes: string;
  metas: string;
};

export type TipoLei =
  | "lei_ordinaria"
  | "decreto"
  | "estrutura"
  | "ppa"
  | "ldo"
  | "loa";

export type Filtros = {
  ano: number | null;
  eixos: string[];
  categorias: number[];
  orgaos: string[];
  busca: string;
};

export const FILTROS_VAZIOS: Filtros = {
  ano: null,
  eixos: [],
  categorias: [],
  orgaos: [],
  busca: "",
};

export type Totais = {
  aprop: number;
  liq: number;
  execucao: number | null;
  dotacoes: number;
  entregas: number;
  orgaos: number;
};
