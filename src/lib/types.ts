/**
 * Procedência do valor planejado de uma dotação.
 *
 * `relatorio` é o caso normal — o número veio da fonte, apurado pelo COSG.
 * `dotacao-atualizada` é derivado do QDD na importação, e só acontece em emenda
 * parlamentar que o relatório reporta zerada.
 */
export type OrigemPlanejado = "relatorio" | "dotacao-atualizada";

/** Um registro = uma entrega apropriada. É a granularidade da Tabela_OSG. */
export type Registro = {
  id: string;
  ano: number;
  categoria: number;
  /** Código do órgão no QDD, sem barra: `"721"`. */
  orgaoCodigo: string;
  orgaoNome: string;
  /** Código da unidade orçamentária no QDD: `"302"`. */
  unidadeCodigo: string;
  unidadeNome: string;
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

  // --- Sistema de Orçamentos Temáticos (2026 em diante) ---

  /** Orçamento temático de origem. Este painel só exibe `"OSG"`. */
  tema: string;
  /** Ciclo de apuração: `"Ciclo de Validação 2026"`. Vazio em 2024/2025. */
  ciclo: string;
  /**
   * Fator de apropriação: 1 na categoria 1, 0,5 na categoria 3, `null` na 2.
   *
   * O nulo é o dado, não a ausência dele: na categoria 2 a apropriação é
   * discriminada caso a caso e não existe fator. Ver `ponderadorDe`.
   */
  ponderador: number | null;
  /** Planejado da dotação inteira, já ponderado. Igual em todas as entregas do grupo. */
  planejadoDotacao: number;
  /**
   * De onde saiu `planejadoDotacao`.
   *
   * `"dotacao-atualizada"` marca as emendas parlamentares, cujo planejado o
   * relatório reporta como zero — elas entram na LOA zeradas e só recebem valor
   * na dotação atualizada. A importação deriva o valor do QDD, e a distinção
   * precisa sobreviver até a tela: é a diferença entre um número apurado pelo
   * COSG e um número calculado aqui.
   */
  planejadoOrigem: OrigemPlanejado;
  /**
   * Planejado discriminado desta entrega, ou `null` quando a fonte não discrimina.
   *
   * Nulo significa que `apropOsg` é rateio, não valor apurado — é o que o painel
   * usa para não apresentar um número inventado como se fosse da fonte.
   */
  planejadoEntrega: number | null;
  /** Liquidado da dotação inteira. Gravado sempre; exibido só com o exercício fechado. */
  liqDotacao: number;
  /** 17 dígitos: função(2) + subfunção(3) + programa(4) + ação(8). */
  funcaoProgramatica: string;
  entregaDescricao: string;
  quantidade: number;
  municipio: string;
  publicoBeneficiado: string;
};

/**
 * Uma dotação agrupa as entregas de um mesmo
 * (ano, órgão, unidade orçamentária, projeto/atividade). É o que o painel exibe.
 *
 * A unidade entra na chave porque é ela que identifica a dotação no QDD: a mesma
 * ação orçamentária costuma existir na Unidade Gestora e num fundo do mesmo
 * órgão, com valores diferentes.
 */
export type Dotacao = {
  chave: string;
  ano: number;
  orgaoCodigo: string;
  orgaoNome: string;
  unidadeCodigo: string;
  unidadeNome: string;
  aplicacaoProgramada: string;
  projetoAtividade: string;
  funcaoCodigo: string;
  programaCodigo: string;
  /**
   * Eixos presentes nas entregas, na ordem da Lei nº 4.168/2023 — normalmente
   * um só. Lista pelo mesmo motivo de `categorias`: a SEOP 754/001, ação
   * 11000000, reúne em 2024 a Casa da Mulher Brasileira (eixo I) e uma entrega
   * de Governança (eixo VI). Com um campo único, a dotação ficava só com o eixo
   * da primeira entrega e sumia da contagem do outro.
   */
  eixos: string[];
  /** Categorias presentes nas entregas — normalmente uma só. */
  categorias: number[];
  apropOsg: number;
  liqOsg: number;
  orcAprovadoProjeto: number;
  orcFinalProjeto: number;
  entregas: Registro[];
  /** Ponderador da dotação, quando único entre as entregas. Ver `Registro.ponderador`. */
  ponderador: number | null;
  /**
   * Planejado informado pela fonte no nível da dotação, copiado do primeiro
   * registro do grupo — como `orcAprovadoProjeto`, e pelo mesmo motivo: é um
   * valor do grupo inteiro, então somá-lo sobre as entregas o multiplicaria.
   *
   * NÃO substitui `apropOsg` no que a tela exibe. `apropOsg` é a soma das
   * entregas do recorte, e é ela que tem de aparecer: quando um filtro seleciona
   * parte das entregas de uma dotação, o valor mostrado precisa encolher junto,
   * senão a linha da tabela passa a divergir do total do painel. Serve para
   * conferência — o rateio é montado para que as duas somas coincidam ao centavo.
   */
  planejadoDotacao: number;
  /** Procedência de `planejadoDotacao`. Ver `Registro.planejadoOrigem`. */
  planejadoOrigem: OrigemPlanejado;
};

/**
 * Uma linha do QDD, na granularidade de
 * (exercício, órgão, unidade, projeto/atividade, fonte, conta de despesa).
 *
 * É mais fina que a dotação: uma mesma dotação costuma se repartir em várias
 * fontes de recurso e várias contas de despesa — no OSG, 95 das 155 dotações que
 * casam com o QDD usam duas ou mais fontes, e uma delas usa vinte. Quem precisa
 * do total da dotação soma as linhas casadas, que é o que `baseDotacao` faz.
 *
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
  /** Fonte de recurso, oito dígitos (Portaria STN nº 710/2021). */
  fonte: string;
  /**
   * Conta de despesa, dez dígitos e sem espaços: categoria econômica (1) +
   * grupo de natureza (1) + modalidade de aplicação (2) + elemento (2) +
   * subelemento (4). Guardada inteira em vez de repartida em cinco colunas —
   * cinco campos derivados podem divergir da origem, uma string não.
   */
  contaDespesa: string;
  descricaoDespesa: string;
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
  /** Códigos de órgão: `"721"`. */
  orgaos: string[];
  /**
   * Unidades orçamentárias, como PAR órgão/unidade: `"721/302"`.
   *
   * O par, e não o código nu: `"001"` é a Unidade Gestora de onze órgãos
   * diferentes, e filtrar por ele sozinho traria todas elas.
   */
  unidades: string[];
  busca: string;
};

export const FILTROS_VAZIOS: Filtros = {
  ano: null,
  eixos: [],
  categorias: [],
  orgaos: [],
  unidades: [],
  busca: "",
};

export type Totais = {
  aprop: number;
  /**
   * `null` quando todo o recorte está em exercício de execução ainda aberta.
   *
   * O nulo nasce em `calcularTotais`, e não em cada tela, para que o painel, o
   * XLSX e o PDF não possam discordar entre si sobre o que é exibível.
   */
  liq: number | null;
  execucao: number | null;
  dotacoes: number;
  entregas: number;
  orgaos: number;
  /** Unidades orçamentárias distintas — pares órgão/unidade, não órgãos. */
  unidades: number;
  /** Todo o recorte está em exercício com execução em apuração. */
  emApuracao: boolean;
};
