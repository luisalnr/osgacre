import { chave, nomeEixo, nomeFuncao } from "./referencias";
import type { Dotacao, DotacaoQdd, Filtros, Registro, Totais } from "./types";

/**
 * Agrupa as entregas na dotação que o painel exibe: (ano, órgão, projeto/atividade).
 *
 * O órgão entra na chave porque uma mesma ação orçamentária pode ser executada
 * por unidades diferentes — a ação 21570000 de 2024, por exemplo, tem entregas
 * de SEJUSP, PMAC e CBMAC. Já `orcAprovadoProjeto` NÃO é recalculado aqui: ele
 * vem da importação somado sobre o projeto inteiro, porque é assim que o rateio
 * da planilha funciona.
 */
export function agruparEmDotacoes(registros: Registro[]): Dotacao[] {
  const mapa = new Map<string, Dotacao>();
  for (const r of registros) {
    const k = `${r.ano}|${r.orgaoSigla}|${r.projetoAtividade}`;
    let d = mapa.get(k);
    if (!d) {
      d = {
        chave: k,
        ano: r.ano,
        orgaoCodigo: r.orgaoCodigo,
        orgaoSigla: r.orgaoSigla,
        orgaoNome: r.orgaoNome,
        aplicacaoProgramada: r.aplicacaoProgramada,
        projetoAtividade: r.projetoAtividade,
        funcaoCodigo: r.funcaoCodigo,
        programaCodigo: r.programaCodigo,
        eixo: r.eixo,
        categorias: [],
        apropOsg: 0,
        liqOsg: 0,
        orcAprovadoProjeto: r.orcAprovadoProjeto,
        orcFinalProjeto: r.orcFinalProjeto,
        entregas: [],
      };
      mapa.set(k, d);
    }
    d.apropOsg += r.apropOsg;
    d.liqOsg += r.liqOsg;
    if (!d.categorias.includes(r.categoria)) d.categorias.push(r.categoria);
    d.entregas.push(r);
  }
  for (const d of mapa.values()) d.categorias.sort();
  return [...mapa.values()].sort((a, b) => b.apropOsg - a.apropOsg);
}

/**
 * Índice do QDD para consulta rápida por dotação.
 *
 * Duas chaves porque a junção precisa de um recuo: a maioria das dotações casa
 * por (órgão, projeto/atividade), mas há ações compartilhadas — a entrega está
 * registrada na PMAC e a dotação, no QDD, aparece na SEJUSP. O órgão sai de
 * dos dígitos iniciais de `orgaoCodigo`: em `719/219` o 719 é o órgão, mas o
 * 219 NÃO é o código de unidade do QDD (lá a dotação está na unidade 626),
 * então a junção não pode usar unidade.
 */
export type IndiceQdd = {
  porOrgaoProjeto: Map<string, DotacaoQdd[]>;
  porProjeto: Map<string, DotacaoQdd[]>;
};

const orgaoDe = (codigo: string) => codigo.match(/^\d+/)?.[0] ?? "";

export function indexarQdd(dotacoes: DotacaoQdd[]): IndiceQdd {
  const porOrgaoProjeto = new Map<string, DotacaoQdd[]>();
  const porProjeto = new Map<string, DotacaoQdd[]>();
  const juntar = (m: Map<string, DotacaoQdd[]>, k: string, d: DotacaoQdd) => {
    const lista = m.get(k);
    if (lista) lista.push(d);
    else m.set(k, [d]);
  };
  for (const d of dotacoes) {
    juntar(porOrgaoProjeto, `${d.ano}|${d.orgaoCodigo}|${d.projetoAtividade}`, d);
    juntar(porProjeto, `${d.ano}|${d.projetoAtividade}`, d);
  }
  return { porOrgaoProjeto, porProjeto };
}

export type OrigemBase =
  | "qdd-orgao"
  | "qdd-projeto"
  | "planilha"
  | "indisponivel";

export type BaseDotacao = {
  /** Denominador escolhido para o percentual. */
  valor: number | null;
  origem: OrigemBase;
  inicial: number | null;
  atualizada: number | null;
  /** Liquidado da dotação inteira, quando o QDD está disponível. */
  liquidadoProjeto: number | null;
  /** A base usada foi a dotação atualizada, e não a inicial. */
  usouAtualizada: boolean;
};

const somar = (lista: DotacaoQdd[], campo: keyof DotacaoQdd) =>
  lista.reduce((s, d) => s + (d[campo] as number), 0);

/**
 * Resolve o par (dotação inicial, dotação atualizada) de uma dotação do OSG e
 * escolhe qual serve de denominador.
 *
 * A regra é: **a inicial quando ela cobre a apropriação, senão a maior das
 * duas**. Não basta usar sempre a atualizada — em 55 das 150 dotações da base
 * atual a atualizada é MENOR que a inicial, porque a dotação foi reduzida
 * durante o exercício; ali a inicial é a referência certa, e é ela que faz a
 * metodologia fechar (categoria 1 dá 100%, categoria 3 dá 50%).
 *
 * A atualizada entra exatamente nos dois casos que o aprovado não cobre:
 * remanejamento/suplementação durante o exercício, e emendas parlamentares,
 * que nascem com dotação inicial zerada.
 */
export function baseDotacao(d: Dotacao, qdd: IndiceQdd | null): BaseDotacao {
  let inicial: number | null = null;
  let atualizada: number | null = null;
  let liquidadoProjeto: number | null = null;
  let origem: OrigemBase = "indisponivel";

  const doQdd =
    qdd?.porOrgaoProjeto.get(
      `${d.ano}|${orgaoDe(d.orgaoCodigo)}|${d.projetoAtividade}`
    ) ?? null;
  const recuo = doQdd ?? qdd?.porProjeto.get(`${d.ano}|${d.projetoAtividade}`) ?? null;

  if (recuo?.length) {
    origem = doQdd ? "qdd-orgao" : "qdd-projeto";
    inicial = somar(recuo, "dotacaoInicial");
    atualizada = somar(recuo, "dotacaoAtualizada");
    liquidadoProjeto = somar(recuo, "liquidado");
  } else if (d.orcAprovadoProjeto || d.orcFinalProjeto) {
    // Sem QDD carregado para o exercício, os valores rateados da planilha
    // seguram a leitura. São menos confiáveis: em ~10% das dotações a planilha
    // repete o valor do projeto em cada linha em vez de dividi-lo.
    origem = "planilha";
    inicial = d.orcAprovadoProjeto || null;
    atualizada = d.orcFinalProjeto || null;
  }

  const i = inicial ?? 0;
  const a = atualizada ?? 0;
  let valor: number | null = null;
  let usouAtualizada = false;
  if (i > 0 && d.apropOsg <= i + 0.01) {
    valor = i;
  } else if (Math.max(i, a) > 0) {
    valor = Math.max(i, a);
    usouAtualizada = a > i;
  }

  return { valor, origem, inicial, atualizada, liquidadoProjeto, usouAtualizada };
}

export type PesoDotacao = {
  percentual: number | null;
  /** A apropriação registrada supera a dotação: o painel mostra "a conferir". */
  aConferir: boolean;
  base: BaseDotacao;
};

/** Peso do OSG na dotação: quanto da ação orçamentária foi apropriado ao OSG. */
export function pesoNaDotacao(d: Dotacao, qdd: IndiceQdd | null): PesoDotacao {
  const base = baseDotacao(d, qdd);
  if (!base.valor) return { percentual: null, aConferir: false, base };
  if (d.apropOsg > base.valor * 1.005) {
    return { percentual: null, aConferir: true, base };
  }
  return { percentual: (d.apropOsg / base.valor) * 100, aConferir: false, base };
}

export function calcularTotais(registros: Registro[]): Totais {
  const aprop = registros.reduce((s, r) => s + r.apropOsg, 0);
  const liq = registros.reduce((s, r) => s + r.liqOsg, 0);
  return {
    aprop,
    liq,
    execucao: aprop ? (liq / aprop) * 100 : null,
    dotacoes: new Set(
      registros.map((r) => `${r.ano}|${r.orgaoSigla}|${r.projetoAtividade}`)
    ).size,
    entregas: registros.length,
    orgaos: new Set(registros.map((r) => r.orgaoSigla)).size,
  };
}

export type Fatia = {
  chave: string;
  rotulo: string;
  aprop: number;
  liq: number;
  execucao: number | null;
};

function somarPor(
  registros: Registro[],
  chaveDe: (r: Registro) => string,
  rotuloDe: (k: string) => string
): Fatia[] {
  const mapa = new Map<string, { aprop: number; liq: number }>();
  for (const r of registros) {
    const k = chaveDe(r);
    const atual = mapa.get(k) ?? { aprop: 0, liq: 0 };
    atual.aprop += r.apropOsg;
    atual.liq += r.liqOsg;
    mapa.set(k, atual);
  }
  return [...mapa.entries()]
    .map(([k, v]) => ({
      chave: k,
      rotulo: rotuloDe(k),
      aprop: v.aprop,
      liq: v.liq,
      execucao: v.aprop ? (v.liq / v.aprop) * 100 : null,
    }))
    .sort((a, b) => b.aprop - a.aprop);
}

export const porEixo = (registros: Registro[]) =>
  somarPor(registros, (r) => r.eixo, nomeEixo);

export const porCategoria = (registros: Registro[]) =>
  somarPor(
    registros,
    (r) => String(r.categoria),
    (k) => `Categoria ${k}`
  ).sort((a, b) => Number(a.chave) - Number(b.chave));

export const porFuncao = (registros: Registro[]) =>
  somarPor(registros, (r) => r.funcaoCodigo, nomeFuncao);

export const porOrgao = (registros: Registro[], limite?: number) => {
  const todos = somarPor(
    registros,
    (r) => r.orgaoSigla,
    (k) => k.replace(/^[\d/]+\s*-\s*/, "")
  );
  return limite ? todos.slice(0, limite) : todos;
};

export const porAno = (registros: Registro[]) =>
  somarPor(
    registros,
    (r) => String(r.ano),
    (k) => k
  ).sort((a, b) => Number(a.chave) - Number(b.chave));

export type Opcoes = {
  anos: number[];
  eixos: { valor: string; rotulo: string }[];
  categorias: number[];
  orgaos: { valor: string; rotulo: string }[];
};

/** Opções dos filtros, derivadas do que existe na base (não de listas fixas). */
export function opcoesDeFiltro(registros: Registro[]): Opcoes {
  const anos = [...new Set(registros.map((r) => r.ano))].sort((a, b) => b - a);
  const eixos = [...new Set(registros.map((r) => r.eixo))]
    .map((e) => ({ valor: e, rotulo: nomeEixo(e) }))
    .sort((a, b) => a.rotulo.localeCompare(b.rotulo, "pt-BR"));
  const categorias = [...new Set(registros.map((r) => r.categoria))].sort();
  const orgaos = [...new Set(registros.map((r) => r.orgaoSigla))]
    .map((o) => ({ valor: o, rotulo: o }))
    .sort((a, b) => a.rotulo.localeCompare(b.rotulo, "pt-BR"));
  return { anos, eixos, categorias, orgaos };
}

export function filtrar(registros: Registro[], f: Filtros): Registro[] {
  const busca = chave(f.busca);
  return registros.filter((r) => {
    if (f.ano !== null && r.ano !== f.ano) return false;
    if (f.eixos.length && !f.eixos.includes(r.eixo)) return false;
    if (f.categorias.length && !f.categorias.includes(r.categoria)) return false;
    if (f.orgaos.length && !f.orgaos.includes(r.orgaoSigla)) return false;
    if (busca) {
      const alvo = chave(
        `${r.aplicacaoProgramada} ${r.entrega} ${r.orgaoSigla} ${r.orgaoNome} ${r.projetoAtividade} ${r.programaCodigo}`
      );
      if (!alvo.includes(busca)) return false;
    }
    return true;
  });
}

/** Quantos filtros (fora o exercício) estão ativos — usado no botão "limpar". */
export function filtrosAtivos(f: Filtros): number {
  return (
    f.eixos.length +
    f.categorias.length +
    f.orgaos.length +
    (f.busca.trim() ? 1 : 0)
  );
}
