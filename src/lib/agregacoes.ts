import { chave, nomeEixo, nomeFuncao } from "./referencias";
import type { Dotacao, Filtros, Registro, Totais } from "./types";

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
 * Peso do OSG na dotação: quanto da ação orçamentária foi apropriado ao OSG.
 * Denominador é o orçamento aprovado do projeto — ver `parser-osg.ts`.
 * Devolve `null` quando a planilha não informa o aprovado.
 */
export function pesoNaDotacao(d: Dotacao): number | null {
  if (!d.orcAprovadoProjeto) return null;
  return (d.apropOsg / d.orcAprovadoProjeto) * 100;
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
