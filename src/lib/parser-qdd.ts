import { hashId } from "./id";
import { limparNome } from "./orgaos";
import { chave } from "./referencias";
import type { DotacaoQdd } from "./types";

/**
 * Leitor do QDD — Quadro de Detalhamento da Despesa.
 *
 * O arquivo vem em `.xls` antigo (BIFF8) com uma linha por conta de despesa e
 * fonte, e é **nessa granularidade que ele é guardado**:
 * (exercício, órgão, unidade, projeto/atividade, fonte, conta de despesa).
 *
 * Já foi agregado por dotação, e isso apagava fonte de recurso, categoria
 * econômica, grupo de natureza, modalidade e elemento — as classificações que a
 * tabela detalhada e a planilha de exportação mostram. Quem quer o total da
 * dotação soma as linhas casadas, que é o que `baseDotacao` sempre fez.
 *
 * Continua sendo uma agregação, e não uma cópia linha a linha, por precaução: nos
 * QDD de 2024 e 2025 a chave completa não se repete nenhuma vez, mas se um
 * exercício futuro trouxer a mesma (fonte, conta) duas vezes na mesma dotação os
 * valores se somam, em vez de uma linha sobrescrever a outra.
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
  "Conta de Despesa",
  "Descrição da Despesa",
  "Fonte",
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
  "Conta de Despesa": ["conta de despesa", "conta despesa"],
  "Descrição da Despesa": ["descricao da despesa", "descricao despesa"],
  Fonte: ["fonte"],
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
  /** Dotações distintas (órgão, unidade, projeto) dentro das linhas gravadas. */
  dotacoesDistintas: number;
  /** Códigos de fonte de recurso distintos encontrados no arquivo. */
  fontes: string[];
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

/**
 * "721 SECRETARIA DE ESTADO DE SAÚDE" → { codigo: "721", nome: "SECRETARIA…" }
 *
 * O nome passa por `limparNome` aqui, e não na exibição: o QDD grava os nomes
 * quebrados na largura da coluna do relatório ("MEIO AMBIEN TE", "PENITEN-
 * CIÁRIA"), e a quebra é artefato de impressão, não dado. Limpar na leitura faz
 * o nome certo chegar ao banco, ao seed e a quem consumir a API — limpar só na
 * tela deixaria o texto quebrado viajando em todo payload.
 */
function separarCodigo(bruto: string): { codigo: string; nome: string } {
  const t = texto(bruto);
  const m = t.match(/^(\d+)\s*(.*)$/);
  if (!m) return { codigo: "", nome: limparNome(t) };
  return { codigo: m[1], nome: limparNome(m[2]) };
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
      dotacoesDistintas: 0,
      fontes: [],
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

    // A conta vem espaçada no relatório ("3 3 90 30 00 00"); guardamos os dez
    // dígitos colados. O subelemento (os quatro últimos) NÃO pode ser cortado:
    // ele assume 0000 e 9900, e truncar fundiria duas linhas contábeis.
    const conta = texto(col(linha, "Conta de Despesa")).replace(/\D/g, "");
    const fonte = texto(col(linha, "Fonte"));

    const k = `${orgao.codigo}|${unidade.codigo}|${projeto}|${fonte}|${conta}`;
    let d = agregado.get(k);
    if (!d) {
      d = {
        // A chave do hash é a chave da agregação, inteira. Se fonte e conta
        // ficassem de fora, todas as linhas de uma mesma dotação nasceriam com o
        // mesmo id, e o upsert da API as sobrescreveria uma sobre a outra até
        // sobrar uma — sem erro nenhum, com números plausíveis.
        id: hashId("qdd", ano ?? 0, orgao.codigo, unidade.codigo, projeto, fonte, conta),
        ano: ano ?? 0,
        orgaoCodigo: orgao.codigo,
        orgaoNome: orgao.nome,
        unidadeCodigo: unidade.codigo,
        unidadeNome: unidade.nome,
        projetoAtividade: projeto,
        aplicacaoProgramada: texto(col(linha, "Aplicação Programada")),
        funcaoProgramatica: texto(col(linha, "Função Programática")).replace(/^'/, ""),
        fonte,
        contaDespesa: conta,
        descricaoDespesa: texto(col(linha, "Descrição da Despesa")),
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

  // Sem a coluna Fonte o arquivo ainda é lido, mas colapsa para a granularidade
  // antiga com tudo em `fonte: ""` — e aí a tabela detalhada e a planilha ficam
  // sem fonte de recurso, calados. Melhor dizer isso em voz alta.
  if (!colunasEncontradas["Fonte"]) {
    avisos.push(
      "Sem a coluna Fonte, este arquivo não traz fonte de recurso: as dotações entram agregadas, como antes."
    );
  }

  const fontes = [...new Set(dotacoes.map((d) => d.fonte).filter(Boolean))].sort();
  const dotacoesDistintas = new Set(
    dotacoes.map((d) => `${d.orgaoCodigo}|${d.unidadeCodigo}|${d.projetoAtividade}`)
  ).size;

  return {
    dotacoes,
    linhasContabeis,
    dotacoesDistintas,
    fontes,
    colunasEncontradas,
    anos: ano ? [ano] : [],
    avisos,
  };
}
