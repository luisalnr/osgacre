import dados from "../../public/data/seed-ods.json";
import type { EixoSlug } from "./referencias";

export type StatusIndicadorOds =
  | "produzido"
  | "em-analise"
  | "sem-dados"
  | "sem-metodologia"
  | "nao-se-aplica";

export type IndicadorOds = {
  codigo: string;
  nome: string;
  status: StatusIndicadorOds;
  eixos: EixoSlug[];
  /** Ficha de resultados no ODS Brasil — só existe para indicadores produzidos. */
  url?: string;
};

export type ObjetivoOds = {
  numero: number;
  titulo: string;
  cor: string;
  indicadores: IndicadorOds[];
};

export type DadosOds = {
  consultadoEm: string;
  fontes: {
    brasil: string;
    onuGenero: string;
  };
  objetivos: ObjetivoOds[];
};

export const DADOS_ODS = dados as DadosOds;

export const ROTULO_STATUS_ODS: Record<StatusIndicadorOds, string> = {
  produzido: "Produzido",
  "em-analise": "Em análise/construção",
  "sem-dados": "Sem dados",
  "sem-metodologia": "Sem metodologia global",
  "nao-se-aplica": "Não se aplica ao Brasil",
};

export const ORDEM_STATUS_ODS: StatusIndicadorOds[] = [
  "produzido",
  "em-analise",
  "sem-dados",
  "sem-metodologia",
  "nao-se-aplica",
];

