import { hashId } from "./id";
import { chave } from "./referencias";
import type { DotacaoQdd } from "./types";

/**
 * Leitor do QDD — Quadro de Detalhamento da Despesa.
 *
 * O arquivo vem em `.xls` antigo (BIFF8) com uma linha por conta de despesa e
 * fonte. Aqui ele é agregado para a granularidade da dotação:
 * (exercício, órgão, unidade, projeto/atividade).
 *
 * A coluna que interessa é `Ini+Sup+Cor-Red (B)`, a dotação atualizada. É ela
 * que reflete remanejamentos durante o exercício e é a única onde as emendas
 * parlamentares aparecem — elas entram na LOA com dotação inicial zerada e só
 * recebem valor depois da alocação dos planos de trabalho.
 */

export const COLUNAS_QDD = [
  "Órgão",
  "Unidade",
  "Aplicação Programada",
  "Função Programática",
  "Projeto Atividade",
  "Dotação Inicial ( A )",
  "Suplementado",
  "Ini+Sup+Cor-Red (B)",
  "Empenhado + Complementado ( C )",
  "Liquidado ( D )",
  "A Liquidar ( A+B-D )",
  "Pago ( E )",
] as const;

/** Sinônimos por coluna — os rótulos variam em espaçamento entre exercícios. */
const ALIASES: Record<string, string[]> = {
  "Órgão": ["orgao"],
  Unidade: ["unidade"],
  "Aplicação Programada": ["aplicacao programada"],
  "Função Programática": ["funcao programatica"],
  "Projeto Atividade": ["projeto atividade", "projeto/atividade"],
  "Dotação Inicial ( A )": ["dotacao inicial ( a )", "dotacao inicial (a)", "dotacao inicial"],
  Suplementado: ["suplementado"],
  "Ini+Sup+Cor-Red (B)": ["ini+sup+cor-red (b)", "ini+sup+cor-red ( b )", "ini+sup+cor-red"],
  "Empenhado + Complementado ( C )": [
    "empenhado + complementado ( c )",
    "empenhado + complementado (c)",
    "empenhado",
  ],
  "Liquidado ( D )": ["liquidado ( d )", "liquidado (d)", "liquidado"],
  "A Liquidar ( A+B-D )": ["a liquidar ( a+b-d )", "a liquidar (a+b-d)", "a liquidar"],
  "Pago ( E )": ["pago ( e )", "pago (e)", "pago"],
};

export type ResultadoQdd = {
  dotacoes: DotacaoQdd[];
  /** Linhas contábeis lidas antes da agregação. */
  linhasContabeis: number;
  colunasEncontradas: Record<string, boolean>;
  anos: number[];
  avisos: string[];
};

function texto(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v).replace(/\s+/g, " ").trim();
}

function numero(v: unknown): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const t = texto(v);
  if (!t) return 0;
  const limpo = t
    .replace(/[^0-9,.-]/g, "")
    .replace(/\.(?=\d{3}(\D|$))/g, "")
    .replace(",", ".");
  const n = Number(limpo);
  return Number.isFinite(n) ? n : 0;
}

/** "721 SECRETARIA DE ESTADO DE SAÚDE" → { codigo: "721", nome: "SECRETARIA…" } */
function separarCodigo(bruto: string): { codigo: string; nome: string } {
  const t = texto(bruto);
  const m = t.match(/^(\d+)\s*(.*)$/);
  if (!m) return { codigo: "", nome: t };
  return { codigo: m[1], nome: m[2].trim() };
}

/** O cabeçalho fica depois de linhas de título e de parâmetros do relatório. */
function acharCabecalho(linhas: unknown[][]): number {
  for (let i = 0; i < Math.min(linhas.length, 40); i++) {
    const celulas = (linhas[i] ?? []).map((c) => chave(texto(c)));
    if (celulas[0] === "orgao" && celulas.some((c) => c.startsWith("projeto atividade"))) {
      return i;
    }
  }
  return -1;
}

function mapearColunas(cabecalho: unknown[]): Map<string, number> {
  const normalizadas = cabecalho.map((c) => chave(texto(c)));
  const mapa = new Map<string, number>();
  for (const coluna of COLUNAS_QDD) {
    const candidatos = [chave(coluna), ...(ALIASES[coluna] ?? [])];
    let i = normalizadas.findIndex((c) => candidatos.includes(c));
    if (i < 0) i = normalizadas.findIndex((c) => candidatos.some((a) => c.startsWith(a)));
    if (i >= 0) mapa.set(coluna, i);
  }
  return mapa;
}

/**
 * O exercício não é uma coluna: vem no cabeçalho do relatório, em uma célula
 * como "Exercício: 2025".
 */
export function acharExercicio(linhas: unknown[][]): number | null {
  for (let i = 0; i < Math.min(linhas.length, 40); i++) {
    for (const celula of linhas[i] ?? []) {
      const m = texto(celula).match(/exerc[íi]cio:?\s*(\d{4})/i);
      if (m) return Number(m[1]);
    }
  }
  return null;
}

export function parseQdd(linhas: unknown[][], anoInformado?: number): ResultadoQdd {
  const avisos: string[] = [];
  const cabecalhoIdx = acharCabecalho(linhas);
  if (cabecalhoIdx < 0) {
    return {
      dotacoes: [],
      linhasContabeis: 0,
      colunasEncontradas: Object.fromEntries(
        COLUNAS_QDD.map((c) => [c, false])
      ) as Record<string, boolean>,
      anos: [],
      avisos: [
        "Não encontrei o cabeçalho do QDD. A planilha precisa ter as colunas Órgão e Projeto Atividade.",
      ],
    };
  }

  const ano = anoInformado ?? acharExercicio(linhas);
  if (!ano) {
    avisos.push(
      "Não encontrei o exercício no cabeçalho do relatório (\"Exercício: AAAA\")."
    );
  }

  const mapa = mapearColunas(linhas[cabecalhoIdx]);
  const colunasEncontradas = Object.fromEntries(
    COLUNAS_QDD.map((c) => [c, mapa.has(c)])
  ) as Record<string, boolean>;

  const col = (linha: unknown[], nome: string): unknown => {
    const i = mapa.get(nome);
    return i === undefined ? "" : linha[i];
  };

  const agregado = new Map<string, DotacaoQdd>();
  let linhasContabeis = 0;

  for (let i = cabecalhoIdx + 1; i < linhas.length; i++) {
    const linha = linhas[i] ?? [];
    const projeto = texto(col(linha, "Projeto Atividade"));
    // Sem código de projeto/atividade a linha é rodapé ou totalização.
    if (!projeto || !/^\d+$/.test(projeto)) continue;

    const orgao = separarCodigo(texto(col(linha, "Órgão")));
    const unidade = separarCodigo(texto(col(linha, "Unidade")));
    if (!orgao.codigo) continue;

    linhasContabeis++;
    const k = `${orgao.codigo}|${unidade.codigo}|${projeto}`;
    let d = agregado.get(k);
    if (!d) {
      d = {
        id: hashId("qdd", ano ?? 0, orgao.codigo, unidade.codigo, projeto),
        ano: ano ?? 0,
        orgaoCodigo: orgao.codigo,
        orgaoNome: orgao.nome,
        unidadeCodigo: unidade.codigo,
        unidadeNome: unidade.nome,
        projetoAtividade: projeto,
        aplicacaoProgramada: texto(col(linha, "Aplicação Programada")),
        funcaoProgramatica: texto(col(linha, "Função Programática")).replace(/^'/, ""),
        dotacaoInicial: 0,
        suplementado: 0,
        dotacaoAtualizada: 0,
        empenhado: 0,
        liquidado: 0,
        aLiquidar: 0,
        pago: 0,
      };
      agregado.set(k, d);
    }
    d.dotacaoInicial += numero(col(linha, "Dotação Inicial ( A )"));
    d.suplementado += numero(col(linha, "Suplementado"));
    d.dotacaoAtualizada += numero(col(linha, "Ini+Sup+Cor-Red (B)"));
    d.empenhado += numero(col(linha, "Empenhado + Complementado ( C )"));
    d.liquidado += numero(col(linha, "Liquidado ( D )"));
    d.aLiquidar += numero(col(linha, "A Liquidar ( A+B-D )"));
    d.pago += numero(col(linha, "Pago ( E )"));
  }

  const dotacoes = [...agregado.values()];
  const faltando = Object.entries(colunasEncontradas)
    .filter(([, ok]) => !ok)
    .map(([c]) => c);
  if (faltando.length) avisos.push(`Colunas não encontradas: ${faltando.join(", ")}.`);
  if (!dotacoes.length) avisos.push("Nenhuma dotação reconhecida no arquivo.");

  return {
    dotacoes,
    linhasContabeis,
    colunasEncontradas,
    anos: ano ? [ano] : [],
    avisos,
  };
}
