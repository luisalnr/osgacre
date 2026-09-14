import { LayoutGrid, Scale, Table2, Target, type LucideIcon } from "lucide-react";

/**
 * As seções do painel.
 *
 * A mesma lista alimenta a barra lateral e o banner do topo, para o rótulo do
 * menu e o título da tela nunca dizerem coisas diferentes.
 */
export type SecaoId = "visao" | "tabela" | "instrumentos" | "ods";

export type Secao = {
  id: SecaoId;
  /** Texto curto do menu. */
  rotulo: string;
  icone: LucideIcon;
  /** Título do banner — pode ser mais longo que o rótulo. */
  titulo: string;
  descricao: string;
};

export const SECOES: Secao[] = [
  {
    id: "visao",
    rotulo: "Visão Geral",
    icone: LayoutGrid,
    titulo: "Visão Geral",
    descricao:
      "Totais do exercício e a distribuição do valor planejado do OSG por eixo temático, categoria, função orçamentária e unidade executora.",
  },
  {
    id: "tabela",
    rotulo: "Tabela Detalhada",
    icone: Table2,
    titulo: "Tabela Detalhada",
    descricao:
      "Uma linha por dotação, com a participação do OSG sobre a dotação do QDD. Abra a linha para ver as entregas apropriadas, a classificação orçamentária e as fontes de recurso. Exportável em XLSX e PDF.",
  },
  {
    id: "instrumentos",
    rotulo: "Instrumentos Legais",
    icone: Scale,
    titulo: "Instrumentos Legais",
    descricao:
      "Leis, decretos e instrumentos de planejamento que citam mulheres, gênero ou o próprio Orçamento Sensível ao Gênero, com link para o texto integral no legis.ac.gov.br.",
  },
  {
    id: "ods",
    rotulo: "ODS",
    icone: Target,
    titulo: "Objetivos de Desenvolvimento Sustentável",
    descricao:
      "Alinhamento do Orçamento Sensível ao Gênero à Agenda 2030, com a situação nacional de cada indicador e os eixos temáticos do OSG aos quais ele se relaciona.",
  },
];

export const SECAO_PADRAO: SecaoId = "visao";

export function ehSecaoId(valor: string | null): valor is SecaoId {
  return SECOES.some((secao) => secao.id === valor);
}

/** Seções que recortam dotações do OSG — e portanto mostram os filtros. */
export function usaFiltrosDeDotacao(id: SecaoId): boolean {
  return id === "visao" || id === "tabela";
}

/**
 * Seções que oferecem XLSX e PDF.
 *
 * Regra mais estreita que a dos filtros, de propósito: a Visão Geral também é
 * filtrada, mas o que os dois arquivos trazem é a tabela de dotações. Oferecer
 * a exportação ao lado dos gráficos sugeriria que sairiam os gráficos.
 */
export function permiteExportar(id: SecaoId): boolean {
  return id === "tabela";
}
