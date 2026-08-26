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

/**
 * Situação da dotação diante do que foi planejado para o OSG.
 *
 *  - `normal`        o planejado cabe na base; o percentual é exibido.
 *  - `suplementada`  o planejado passa da dotação inicial da LOA, mas cabe na
 *                    atualizada: a dotação foi reforçada durante o exercício.
 *  - `a-conferir`    o planejado passa das duas; o registro de origem está errado.
 *  - `indisponivel`  não há dotação informada para a ação orçamentária.
 */
export type SituacaoDotacao =
  | "normal"
  | "suplementada"
  | "a-conferir"
  | "indisponivel";

export type BaseDotacao = {
  /** Denominador do percentual. Só existe no estado `normal`. */
  valor: number | null;
  origem: OrigemBase;
  situacao: SituacaoDotacao;
  inicial: number | null;
  atualizada: number | null;
  /** Liquidado da dotação inteira, quando o QDD está disponível. */
  liquidadoProjeto: number | null;
  /** Emenda parlamentar: a base é a dotação atualizada, não a inicial. */
  ehEmenda: boolean;
};

const somar = (lista: DotacaoQdd[], campo: keyof DotacaoQdd) =>
  lista.reduce((s, d) => s + (d[campo] as number), 0);

/**
 * Emendas parlamentares entram na LOA com dotação inicial zerada por
 * construção: só recebem valor depois da alocação dos planos de trabalho dos
 * parlamentares, e isso aparece na dotação atualizada.
 *
 * Dois sinais, aceitos em conjunto porque concordam integralmente na base atual
 * (26 dotações por qualquer um dos critérios) e porque uma mudança de convenção
 * de nomenclatura ou de faixa de código não derruba a identificação inteira.
 */
export function ehEmendaParlamentar(d: Dotacao): boolean {
  return /emenda/i.test(d.aplicacaoProgramada) || /^8028/.test(d.projetoAtividade);
}

/** Margem para não classificar arredondamento de centavo como excesso. */
const TOLERANCIA = 0.01;

/**
 * Resolve a dotação de referência e classifica a situação.
 *
 * A base é a **dotação inicial da LOA**, e não a atualizada: a apropriação do
 * OSG é um número de planejamento, feito sobre a lei orçamentária. Trocar o
 * denominador por causa de uma suplementação posterior mudaria o significado do
 * percentual sem o leitor perceber — e a inicial é o que faz a metodologia
 * fechar (categoria 1 dá 100%, categoria 3 dá 50%).
 *
 * A única exceção são as emendas parlamentares, onde a inicial costuma ser zero
 * e não existe denominador nenhum sem a atualizada.
 *
 * Nas demais dotações, quando o planejado passa da inicial, não se troca a base:
 * o percentual dá lugar a uma anotação, que distingue a dotação suplementada
 * (rotina orçamentária) do registro inconsistente.
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
  const ehEmenda = ehEmendaParlamentar(d);
  const referencia = ehEmenda ? a : i;

  let situacao: SituacaoDotacao;
  let valor: number | null = null;
  if (referencia > 0 && d.apropOsg <= referencia + TOLERANCIA) {
    situacao = "normal";
    valor = referencia;
  } else if (a > 0 && d.apropOsg <= a + TOLERANCIA) {
    situacao = "suplementada";
  } else if (i > 0 || a > 0) {
    situacao = "a-conferir";
  } else {
    situacao = "indisponivel";
  }

  return {
    valor,
    origem,
    situacao,
    inicial,
    atualizada,
    liquidadoProjeto,
    ehEmenda,
  };
}

export type PesoDotacao = {
  /** Preenchido só quando a situação é `normal`. */
  percentual: number | null;
  base: BaseDotacao;
};

/** Peso do OSG na dotação: quanto da ação orçamentária foi apropriado ao OSG. */
export function pesoNaDotacao(d: Dotacao, qdd: IndiceQdd | null): PesoDotacao {
  const base = baseDotacao(d, qdd);
  const percentual = base.valor ? (d.apropOsg / base.valor) * 100 : null;
  return { percentual, base };
}

/** Sobre o que o percentual foi calculado. Vazio quando não há percentual. */
export function rotuloBase(base: BaseDotacao): string {
  if (base.situacao !== "normal") return "";
  return base.ehEmenda ? "dotação atualizada (emenda)" : "dotação inicial";
}

/**
 * Texto da anotação que substitui o percentual. Fica aqui, e não na tela, para
 * que o painel e a exportação digam exatamente a mesma coisa.
 */
export function anotacaoDotacao(base: BaseDotacao, moeda: (v: number) => string): string {
  switch (base.situacao) {
    case "suplementada":
      return `Planejado acima da dotação inicial da LOA — a dotação foi suplementada para ${moeda(base.atualizada ?? 0)} durante o exercício.`;
    case "a-conferir":
      return "Planejado acima da dotação inicial e também da atualizada — o registro precisa de conferência.";
    case "indisponivel":
      return "Não há dotação informada para esta ação orçamentária.";
    default:
      return "";
  }
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
