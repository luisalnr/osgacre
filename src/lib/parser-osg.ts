import { hashId } from "./id";
import { chave, normalizarEixo, normalizarFuncao } from "./referencias";
import type { Registro } from "./types";

/** Colunas esperadas na aba Tabela_OSG, na ordem em que a planilha as traz. */
export const COLUNAS_OSG = [
  "Categoria",
  "Órgão",
  "Órgão_Sigla",
  "Aplicação Programada",
  "Função Orçamentária",
  "Programa",
  "Projeto Atividade",
  "Orçamento Aprovado",
  "Entregas Apropriadas",
  "Eixo",
  "Valor de Apropriação OSG",
  "Orçamento Final",
  "Valor Liquidado Projeto Todo",
  "Valor Liquidado e Apropriado OSG",
  "A Liquidar",
  "Ano",
] as const;

/** Sinônimos aceitos por coluna, caso a planilha mude de rótulo. */
const ALIASES: Record<string, string[]> = {
  Categoria: ["categoria"],
  "Órgão": ["orgao", "orgao/unidade", "unidade orcamentaria"],
  "Órgão_Sigla": ["orgao_sigla", "orgao sigla", "sigla"],
  "Aplicação Programada": ["aplicacao programada", "aplicacao", "dotacao"],
  "Função Orçamentária": ["funcao orcamentaria", "funcao"],
  Programa: ["programa"],
  "Projeto Atividade": ["projeto atividade", "projeto/atividade", "projeto"],
  "Orçamento Aprovado": ["orcamento aprovado", "aprovado"],
  "Entregas Apropriadas": ["entregas apropriadas", "entrega", "entregas"],
  Eixo: ["eixo", "eixo tematico"],
  "Valor de Apropriação OSG": [
    "valor de apropriacao osg",
    "apropriacao osg",
    "valor de apropriacao do osg",
  ],
  "Orçamento Final": ["orcamento final", "orcamento atualizado"],
  "Valor Liquidado Projeto Todo": [
    "valor liquidado projeto todo",
    "liquidado projeto todo",
    "valor liquidado do projeto",
  ],
  "Valor Liquidado e Apropriado OSG": [
    "valor liquidado e apropriado osg",
    "liquidado osg",
    "valor liquidado osg",
  ],
  "A Liquidar": ["a liquidar"],
  Ano: ["ano", "exercicio"],
};

export type Aviso = {
  nivel: "erro" | "aviso";
  mensagem: string;
  linhas: number[];
};

export type ResultadoOSG = {
  registros: Registro[];
  totalLinhas: number;
  colunasEncontradas: Record<string, boolean>;
  anos: number[];
  avisos: Aviso[];
};

function texto(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v).replace(/\s+/g, " ").trim();
}

/** Aceita 1234.56, "1.234,56" e "R$ 1.234,56". */
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

/** Localiza a linha de cabeçalho em vez de assumir que é a primeira. */
function acharCabecalho(linhas: unknown[][]): number {
  for (let i = 0; i < Math.min(linhas.length, 30); i++) {
    const celulas = (linhas[i] ?? []).map((c) => chave(texto(c)));
    const temCategoria = celulas.some((c) => c === "categoria");
    const temEixo = celulas.some((c) => c === "eixo");
    const temAno = celulas.some((c) => c === "ano" || c === "exercicio");
    if (temCategoria && temEixo && temAno) return i;
  }
  return -1;
}

function mapearColunas(cabecalho: unknown[]): Map<string, number> {
  const normalizadas = cabecalho.map((c) => chave(texto(c)));
  const mapa = new Map<string, number>();
  for (const coluna of COLUNAS_OSG) {
    const candidatos = [chave(coluna), ...(ALIASES[coluna] ?? [])];
    let indice = normalizadas.findIndex((c) => candidatos.includes(c));
    if (indice < 0) {
      indice = normalizadas.findIndex((c) =>
        candidatos.some((a) => a.length > 4 && c.includes(a))
      );
    }
    if (indice >= 0) mapa.set(coluna, indice);
  }
  return mapa;
}

/**
 * Converte a Tabela_OSG em registros (um por entrega apropriada).
 *
 * Detalhe que muda o resultado: `Orçamento Aprovado`, `Orçamento Final`,
 * `Valor Liquidado Projeto Todo` e `A Liquidar` chegam RATEADOS pelo número de
 * linhas do grupo (ano, projeto/atividade). Somá-los sobre o grupo inteiro
 * devolve os totais da dotação, gravados em `orcAprovadoProjeto`,
 * `orcFinalProjeto` e `liqProjetoTotal`. Como o rateio ignora o órgão, esses
 * totais nunca podem ser recalculados dentro do recorte por órgão.
 *
 * O denominador do "peso do OSG na dotação" é o orçamento APROVADO do projeto:
 * apropriação e aprovado são ambos números de planejamento, e a razão entre eles
 * reproduz a metodologia — categoria 1 dá 100% e categoria 3 dá 50%. Usar o
 * orçamento atualizado no lugar produziria pesos acima de 100% sempre que a
 * dotação encolhesse durante o exercício.
 */
export function parseTabelaOSG(linhas: unknown[][]): ResultadoOSG {
  const avisos: Aviso[] = [];
  const cabecalhoIdx = acharCabecalho(linhas);
  if (cabecalhoIdx < 0) {
    return {
      registros: [],
      totalLinhas: 0,
      colunasEncontradas: Object.fromEntries(
        COLUNAS_OSG.map((c) => [c, false])
      ) as Record<string, boolean>,
      anos: [],
      avisos: [
        {
          nivel: "erro",
          mensagem:
            "Não encontrei a linha de cabeçalho. A aba precisa ter as colunas Categoria, Eixo e Ano.",
          linhas: [],
        },
      ],
    };
  }

  const mapa = mapearColunas(linhas[cabecalhoIdx]);
  const colunasEncontradas = Object.fromEntries(
    COLUNAS_OSG.map((c) => [c, mapa.has(c)])
  ) as Record<string, boolean>;

  const col = (linha: unknown[], nome: string): unknown => {
    const i = mapa.get(nome);
    return i === undefined ? "" : linha[i];
  };

  type Bruto = Omit<
    Registro,
    "id" | "orcAprovadoProjeto" | "orcFinalProjeto" | "liqProjetoTotal"
  > & { linhaPlanilha: number };
  const brutos: Bruto[] = [];
  const eixosDesconhecidos: number[] = [];
  const categoriasInvalidas: number[] = [];
  const funcoesDesconhecidas: number[] = [];

  for (let i = cabecalhoIdx + 1; i < linhas.length; i++) {
    const linha = linhas[i] ?? [];
    const ano = Math.trunc(numero(col(linha, "Ano")));
    const projeto = texto(col(linha, "Projeto Atividade"));
    const aplicacao = texto(col(linha, "Aplicação Programada"));
    // Linha vazia ou de totalização: sem ano e sem dotação não há o que importar.
    if (!ano || (!projeto && !aplicacao)) continue;

    const orgaoNome = texto(col(linha, "Órgão"));
    const orgaoSigla = texto(col(linha, "Órgão_Sigla")) || orgaoNome;
    const orgaoCodigo = (orgaoSigla.match(/^[\d/]+/)?.[0] ?? "").trim();

    const eixoBruto = texto(col(linha, "Eixo"));
    const eixo = normalizarEixo(eixoBruto);
    if (!eixo && eixoBruto) eixosDesconhecidos.push(i + 1);

    const categoria = Math.trunc(numero(col(linha, "Categoria")));
    if (![1, 2, 3].includes(categoria)) categoriasInvalidas.push(i + 1);

    const funcaoCodigo = normalizarFuncao(texto(col(linha, "Função Orçamentária")));
    if (!funcaoCodigo) funcoesDesconhecidas.push(i + 1);

    brutos.push({
      linhaPlanilha: i + 1,
      ano,
      categoria,
      orgaoCodigo,
      orgaoNome,
      orgaoSigla,
      aplicacaoProgramada: aplicacao,
      projetoAtividade: projeto,
      funcaoCodigo,
      programaCodigo: texto(col(linha, "Programa")),
      eixo: eixo ?? chave(eixoBruto).replace(/\s+/g, "-"),
      entrega: texto(col(linha, "Entregas Apropriadas")),
      apropOsg: numero(col(linha, "Valor de Apropriação OSG")),
      liqOsg: numero(col(linha, "Valor Liquidado e Apropriado OSG")),
      orcAprovado: numero(col(linha, "Orçamento Aprovado")),
      orcFinal: numero(col(linha, "Orçamento Final")),
      liqProjeto: numero(col(linha, "Valor Liquidado Projeto Todo")),
      aLiquidar: numero(col(linha, "A Liquidar")),
    });
  }

  // Totais da dotação inteira = soma do rateio sobre (ano, projeto/atividade).
  type Grupo = { aprovado: number; final: number; liquidado: number; aprop: number };
  const grupos = new Map<string, Grupo>();
  for (const b of brutos) {
    const k = `${b.ano}|${b.projetoAtividade}`;
    const g = grupos.get(k) ?? { aprovado: 0, final: 0, liquidado: 0, aprop: 0 };
    g.aprovado += b.orcAprovado;
    g.final += b.orcFinal;
    g.liquidado += b.liqProjeto;
    g.aprop += b.apropOsg;
    grupos.set(k, g);
  }

  const ordinal = new Map<string, number>();
  const registros: Registro[] = brutos.map((b) => {
    const k = `${b.ano}|${b.projetoAtividade}`;
    const chaveId = `${k}|${b.orgaoCodigo}`;
    const n = (ordinal.get(chaveId) ?? 0) + 1;
    ordinal.set(chaveId, n);
    return {
      id: hashId(b.ano, b.projetoAtividade, b.orgaoCodigo, b.categoria, b.entrega, n),
      ano: b.ano,
      categoria: b.categoria,
      orgaoCodigo: b.orgaoCodigo,
      orgaoNome: b.orgaoNome,
      orgaoSigla: b.orgaoSigla,
      aplicacaoProgramada: b.aplicacaoProgramada,
      projetoAtividade: b.projetoAtividade,
      funcaoCodigo: b.funcaoCodigo,
      programaCodigo: b.programaCodigo,
      eixo: b.eixo,
      entrega: b.entrega,
      apropOsg: b.apropOsg,
      liqOsg: b.liqOsg,
      orcAprovado: b.orcAprovado,
      orcFinal: b.orcFinal,
      liqProjeto: b.liqProjeto,
      aLiquidar: b.aLiquidar,
      orcAprovadoProjeto: grupos.get(k)?.aprovado ?? 0,
      orcFinalProjeto: grupos.get(k)?.final ?? 0,
      liqProjetoTotal: grupos.get(k)?.liquidado ?? 0,
    };
  });

  // Checagens mostradas na prévia da importação.
  const liqMaiorQueAprop = brutos
    .filter((b) => b.liqOsg > b.apropOsg + 0.01)
    .map((b) => b.linhaPlanilha);
  // A apropriação nunca deveria passar do orçamento aprovado da dotação —
  // quando passa, é sinal de coluna preenchida errado na planilha de origem.
  const apropAcimaDoProjeto = [...grupos.entries()]
    .filter(([, g]) => g.aprovado > 0 && g.aprop > g.aprovado + 0.01)
    .map(([k]) => k);
  const semOrcamentoAprovado = [...grupos.entries()]
    .filter(([, g]) => g.aprovado <= 0)
    .map(([k]) => k);

  if (eixosDesconhecidos.length)
    avisos.push({
      nivel: "erro",
      mensagem: "Eixo fora da lista da Lei nº 4.168/2023.",
      linhas: eixosDesconhecidos,
    });
  if (categoriasInvalidas.length)
    avisos.push({
      nivel: "erro",
      mensagem: "Categoria fora do intervalo 1 a 3.",
      linhas: categoriasInvalidas,
    });
  if (funcoesDesconhecidas.length)
    avisos.push({
      nivel: "aviso",
      mensagem: "Função orçamentária vazia ou não numérica.",
      linhas: funcoesDesconhecidas,
    });
  if (liqMaiorQueAprop.length)
    avisos.push({
      nivel: "aviso",
      mensagem: "Liquidado do OSG maior que a apropriação planejada.",
      linhas: liqMaiorQueAprop,
    });
  if (apropAcimaDoProjeto.length)
    avisos.push({
      nivel: "aviso",
      mensagem: `Apropriação do OSG maior que o orçamento aprovado da dotação em ${apropAcimaDoProjeto.length} projeto(s): ${apropAcimaDoProjeto.join(", ")}.`,
      linhas: [],
    });
  if (semOrcamentoAprovado.length)
    avisos.push({
      nivel: "aviso",
      mensagem: `Sem orçamento aprovado informado em ${semOrcamentoAprovado.length} dotação(ões) — o peso do OSG não será calculado nelas: ${semOrcamentoAprovado.join(", ")}.`,
      linhas: [],
    });

  const anos = [...new Set(registros.map((r) => r.ano))].sort();
  return { registros, totalLinhas: registros.length, colunasEncontradas, anos, avisos };
}
