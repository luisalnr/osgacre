import { chaveUnidade, siglaCurta } from "./orgaos";
import { EIXOS, chave, emApuracao, nomeEixo, nomeFuncao, subfuncaoDe } from "./referencias";
import type { Dotacao, DotacaoQdd, Filtros, Registro, Totais } from "./types";

/**
 * Agrupa as entregas na dotação que o painel exibe:
 * (ano, órgão, unidade orçamentária, projeto/atividade).
 *
 * A unidade entra na chave junto com o órgão porque é o par que identifica a
 * dotação no QDD: a mesma ação orçamentária costuma existir na Unidade Gestora
 * e num fundo do mesmo órgão, com valores diferentes — a 11120000 de 2025, por
 * exemplo, está na 719/001 e na 719/637, e somar as duas numa linha só juntaria
 * dotações distintas.
 *
 * Já `orcAprovadoProjeto` NÃO é recalculado aqui: ele vem da importação somado
 * sobre o projeto inteiro, porque é assim que o rateio da planilha funciona.
 */
/** Posição do eixo na Lei nº 4.168/2023; um slug desconhecido vai para o fim. */
const ordemDoEixo = (slug: string) => {
  const i = EIXOS.findIndex((e) => e.slug === slug);
  return i === -1 ? EIXOS.length : i;
};

export function agruparEmDotacoes(registros: Registro[]): Dotacao[] {
  const mapa = new Map<string, Dotacao>();
  for (const r of registros) {
    const k = `${r.ano}|${chaveUnidade(r.orgaoCodigo, r.unidadeCodigo)}|${r.projetoAtividade}`;
    let d = mapa.get(k);
    if (!d) {
      d = {
        chave: k,
        ano: r.ano,
        orgaoCodigo: r.orgaoCodigo,
        orgaoNome: r.orgaoNome,
        unidadeCodigo: r.unidadeCodigo,
        unidadeNome: r.unidadeNome,
        aplicacaoProgramada: r.aplicacaoProgramada,
        projetoAtividade: r.projetoAtividade,
        funcaoCodigo: r.funcaoCodigo,
        programaCodigo: r.programaCodigo,
        eixos: [],
        categorias: [],
        apropOsg: 0,
        liqOsg: 0,
        orcAprovadoProjeto: r.orcAprovadoProjeto,
        orcFinalProjeto: r.orcFinalProjeto,
        entregas: [],
        ponderador: r.ponderador,
        // Copiados do primeiro registro, como `orcAprovadoProjeto` e pelo mesmo
        // motivo: são valores do grupo inteiro, e somá-los os multiplicaria.
        planejadoDotacao: r.planejadoDotacao,
        planejadoOrigem: r.planejadoOrigem,
      };
      mapa.set(k, d);
    }
    // `apropOsg` continua sendo a SOMA das entregas, e não o `planejadoDotacao`
    // informado pela fonte, ainda que os dois coincidam ao centavo por
    // construção do rateio. A função recebe registros já filtrados: quando a
    // busca casa com parte das entregas de uma dotação, o valor exibido tem de
    // encolher junto, senão a linha da tabela passa a divergir do total do
    // painel, que soma registros.
    d.apropOsg += r.apropOsg;
    d.liqOsg += r.liqOsg;
    if (!d.eixos.includes(r.eixo)) d.eixos.push(r.eixo);
    if (!d.categorias.includes(r.categoria)) d.categorias.push(r.categoria);
    if (d.ponderador !== r.ponderador) d.ponderador = null;
    d.entregas.push(r);
  }
  for (const d of mapa.values()) {
    d.categorias.sort();
    // Na ordem da lei (I a VI), e não na das entregas: a tabela e os arquivos
    // exportados listam os eixos sempre na mesma sequência.
    d.eixos.sort((a, b) => ordemDoEixo(a) - ordemDoEixo(b));
  }
  return [...mapa.values()].sort((a, b) => b.apropOsg - a.apropOsg);
}

/**
 * Índice do QDD para consulta rápida por dotação.
 *
 * Três chaves, da mais específica para a mais frouxa. A boa é
 * (órgão, unidade, projeto/atividade): desde que a importação passou a resolver
 * a unidade contra o QDD, ela é exata, e distingue a dotação da Unidade Gestora
 * da do fundo do mesmo órgão — que existem lado a lado e têm valores diferentes.
 *
 * As outras duas são recuo para o dia em que a Tabela OSG trouxer uma dotação
 * que o QDD do exercício ainda não tem. Antes elas eram o caminho normal, porque
 * `orgaoCodigo` vinha como `"719/219"` e a unidade era inutilizável.
 */
export type IndiceQdd = {
  porUnidadeProjeto: Map<string, DotacaoQdd[]>;
  porOrgaoProjeto: Map<string, DotacaoQdd[]>;
  porProjeto: Map<string, DotacaoQdd[]>;
};

export function indexarQdd(dotacoes: DotacaoQdd[]): IndiceQdd {
  const porUnidadeProjeto = new Map<string, DotacaoQdd[]>();
  const porOrgaoProjeto = new Map<string, DotacaoQdd[]>();
  const porProjeto = new Map<string, DotacaoQdd[]>();
  const juntar = (m: Map<string, DotacaoQdd[]>, k: string, d: DotacaoQdd) => {
    const lista = m.get(k);
    if (lista) lista.push(d);
    else m.set(k, [d]);
  };
  for (const d of dotacoes) {
    juntar(
      porUnidadeProjeto,
      `${d.ano}|${chaveUnidade(d.orgaoCodigo, d.unidadeCodigo)}|${d.projetoAtividade}`,
      d
    );
    juntar(porOrgaoProjeto, `${d.ano}|${d.orgaoCodigo}|${d.projetoAtividade}`, d);
    juntar(porProjeto, `${d.ano}|${d.projetoAtividade}`, d);
  }
  return { porUnidadeProjeto, porOrgaoProjeto, porProjeto };
}

/**
 * As linhas do QDD que correspondem a esta dotação, com a origem do casamento.
 *
 * Mora aqui, e não dentro de `baseDotacao`, porque três lugares precisam da
 * **mesma** resolução: o cálculo da participação do OSG, a composição por fonte
 * na tabela detalhada e a planilha de exportação. Se cada um resolvesse por
 * conta própria, a tela poderia listar as fontes de uma dotação enquanto o
 * percentual ao lado teria sido calculado sobre outra.
 *
 * O recuo por projeto existe para as ações compartilhadas entre órgãos — a
 * entrega registrada na PMAC cuja dotação, no QDD, aparece na SEJUSP.
 */
export function linhasDoQdd(
  d: Pick<Dotacao, "ano" | "orgaoCodigo" | "unidadeCodigo" | "projetoAtividade">,
  qdd: IndiceQdd | null
): { linhas: DotacaoQdd[]; origem: OrigemBase } {
  const porUnidade = d.unidadeCodigo
    ? (qdd?.porUnidadeProjeto.get(
        `${d.ano}|${chaveUnidade(d.orgaoCodigo, d.unidadeCodigo)}|${d.projetoAtividade}`
      ) ?? null)
    : null;
  if (porUnidade?.length) return { linhas: porUnidade, origem: "qdd-unidade" };

  const porOrgao =
    qdd?.porOrgaoProjeto.get(
      `${d.ano}|${d.orgaoCodigo}|${d.projetoAtividade}`
    ) ?? null;
  if (porOrgao?.length) return { linhas: porOrgao, origem: "qdd-orgao" };

  const porProjeto = qdd?.porProjeto.get(`${d.ano}|${d.projetoAtividade}`) ?? null;
  if (porProjeto?.length) return { linhas: porProjeto, origem: "qdd-projeto" };

  return { linhas: [], origem: "indisponivel" };
}

/**
 * De onde saiu a base do percentual. As três primeiras vêm do QDD, em ordem
 * decrescente de precisão do casamento; use `veioDoQdd` em vez de comparar uma
 * a uma, que era o que se fazia em quatro lugares diferentes.
 */
export type OrigemBase =
  | "qdd-unidade"
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
  /**
   * A LOA não destinou dotação inicial à ação — o recurso entrou durante o
   * exercício — e nada foi apropriado ao OSG. Não há denominador, e também não
   * há excesso a relatar.
   *
   * Existe para separar este caso de `suplementada`, onde ele caía antes e onde
   * a anotação afirmava que o planejado estava acima da dotação inicial. Com
   * planejado zero e inicial zero isso é falso, e a frase saía numa dotação de
   * R$ 3,7 milhões (a 719/637 13460000, financiada só por superávit).
   */
  | "sem-dotacao-inicial"
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
export function ehEmendaParlamentar(
  // `Pick`, e não `Dotacao`: a função só olha estes dois campos, e o parser de
  // Orçamentos Temáticos precisa chamá-la sobre uma linha bruta, antes de
  // existir dotação agrupada. Repetir a regra lá seria criar uma segunda
  // definição de emenda que um dia diverge desta.
  d: Pick<Dotacao, "aplicacaoProgramada" | "projetoAtividade">
): boolean {
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

  const { linhas: doQdd, origem: origemQdd } = linhasDoQdd(d, qdd);

  if (doQdd.length) {
    origem = origemQdd;
    inicial = somar(doQdd, "dotacaoInicial");
    atualizada = somar(doQdd, "dotacaoAtualizada");
    liquidadoProjeto = somar(doQdd, "liquidado");
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

  // O teste de excesso é explícito porque os dois ramos seguintes descrevem
  // excesso. Sem ele, eles eram alcançados sempre que o primeiro falhava —
  // inclusive quando falhava por a referência ser zero, e não por haver excesso
  // —, e uma dotação de planejado zero e inicial zero era classificada como
  // suplementada, com a anotação afirmando que o planejado passara da inicial.
  const excede = d.apropOsg > referencia + TOLERANCIA;

  let situacao: SituacaoDotacao;
  let valor: number | null = null;
  if (referencia > 0 && !excede) {
    situacao = "normal";
    valor = referencia;
  } else if (!excede) {
    // Não há excesso; o que falta é denominador.
    situacao = a > 0 ? "sem-dotacao-inicial" : "indisponivel";
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

/**
 * As subfunções da dotação, tiradas das linhas do QDD.
 *
 * Lista, e não valor único, porque a dotação se reparte em várias contas de
 * despesa e nem sempre todas caem na mesma subfunção. Achatar para a primeira
 * esconderia a mistura.
 *
 * Vazia quando a dotação não casa com o QDD.
 */
export function subfuncoesDaDotacao(
  d: Pick<
    Dotacao,
    "ano" | "orgaoCodigo" | "unidadeCodigo" | "projetoAtividade" | "entregas"
  >,
  qdd: IndiceQdd | null
): string[] {
  const linhas = linhasDoQdd(d, qdd).linhas;
  const doQdd = [
    ...new Set(linhas.map((l) => subfuncaoDe(l.funcaoProgramatica)).filter(Boolean)),
  ].sort();
  if (doQdd.length) return doQdd;

  // Recuo para a função programática que o relatório de Orçamentos Temáticos
  // traz no próprio registro. Sem ele, um exercício cujo QDD ainda não tenha
  // sido importado sai com a coluna "Subfunção" vazia de ponta a ponta — e o
  // dado estava ali o tempo todo, nos 17 dígitos do "Programa funcional".
  return [
    ...new Set(
      (d.entregas ?? [])
        .map((r) => subfuncaoDe(r.funcaoProgramatica))
        .filter(Boolean)
    ),
  ].sort();
}

export type FonteDaDotacao = {
  fonte: string;
  inicial: number;
  atualizada: number;
  liquidado: number;
};

/**
 * Como a dotação se reparte entre fontes de recurso, segundo o QDD.
 *
 * **São valores da dotação inteira, não do OSG.** O valor apropriado ao OSG não
 * vem repartido por fonte em lugar nenhum da planilha de origem, e reparti-lo
 * aqui — por rateio proporcional, digamos — seria inventar um número. Por isso
 * fonte de recurso é informação sobre a ação orçamentária, nunca uma fatia do
 * OSG. Quem exibe estes números precisa dizer isso junto.
 *
 * Ordenado pela dotação atualizada, decrescente: 95 das 155 dotações do OSG que
 * casam com o QDD usam duas ou mais fontes, uma delas usa vinte, e quem lê quer
 * ver primeiro de onde veio a maior parte do dinheiro.
 */
export function fontesDaDotacao(
  d: Pick<Dotacao, "ano" | "orgaoCodigo" | "unidadeCodigo" | "projetoAtividade">,
  qdd: IndiceQdd | null
): FonteDaDotacao[] {
  const mapa = new Map<string, FonteDaDotacao>();
  for (const l of linhasDoQdd(d, qdd).linhas) {
    let f = mapa.get(l.fonte);
    if (!f) {
      f = { fonte: l.fonte, inicial: 0, atualizada: 0, liquidado: 0 };
      mapa.set(l.fonte, f);
    }
    f.inicial += l.dotacaoInicial;
    f.atualizada += l.dotacaoAtualizada;
    f.liquidado += l.liquidado;
  }
  return [...mapa.values()].sort((a, b) => b.atualizada - a.atualizada);
}

/** Sobre o que o percentual foi calculado. Vazio quando não há percentual. */
/** Se a base do percentual veio do QDD, com qualquer grau de precisão. */
export const veioDoQdd = (origem: OrigemBase): boolean =>
  origem === "qdd-unidade" || origem === "qdd-orgao" || origem === "qdd-projeto";

/**
 * Como a dotação do QDD foi encontrada, para a coluna "origem" da exportação.
 */
export function rotuloOrigemQdd(origem: OrigemBase): string {
  switch (origem) {
    case "qdd-unidade":
      return "por unidade e ação";
    case "qdd-orgao":
      return "por órgão e ação";
    case "qdd-projeto":
      return "por ação (outro órgão)";
    default:
      return "";
  }
}

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
    case "sem-dotacao-inicial":
      return `A LOA não destinou dotação inicial a esta ação — o recurso entrou durante o exercício, chegando a ${moeda(base.atualizada ?? 0)}. Sem dotação inicial não há base para o percentual.`;
    case "indisponivel":
      return "Não há dotação informada para esta ação orçamentária.";
    default:
      return "";
  }
}

/**
 * O recorte inteiro está em exercício de execução ainda aberta.
 *
 * A pergunta é "todos", e não "algum", porque só aí a supressão é inequívoca.
 * Num recorte que mistura 2025 e 2026 o liquidado continua sendo exibido: o de
 * 2025 é real, e escondê-lo apagaria informação boa por causa da companhia. A
 * ressalva do exercício aberto fica então a cargo de quem desenha a leitura —
 * no gráfico de evolução, que é onde os anos aparecem lado a lado, cada
 * exercício responde por si (ver `somarPor`).
 */
const recorteEmApuracao = (registros: Registro[]): boolean =>
  registros.length > 0 && registros.every((r) => emApuracao(r.ano));

export function calcularTotais(registros: Registro[]): Totais {
  const aprop = registros.reduce((s, r) => s + r.apropOsg, 0);
  const somaLiq = registros.reduce((s, r) => s + r.liqOsg, 0);
  const apurando = recorteEmApuracao(registros);
  // O nulo nasce aqui, e não em cada tela, para que o painel, o XLSX e o PDF não
  // possam discordar entre si sobre o que é exibível.
  const liq = apurando ? null : somaLiq;
  return {
    aprop,
    liq,
    emApuracao: apurando,
    execucao: liq !== null && aprop ? (liq / aprop) * 100 : null,
    dotacoes: new Set(
      registros.map(
        (r) =>
          `${r.ano}|${chaveUnidade(r.orgaoCodigo, r.unidadeCodigo)}|${r.projetoAtividade}`
      )
    ).size,
    entregas: registros.length,
    orgaos: new Set(registros.map((r) => r.orgaoCodigo)).size,
    unidades: new Set(
      registros.map((r) => chaveUnidade(r.orgaoCodigo, r.unidadeCodigo))
    ).size,
  };
}

export type Fatia = {
  chave: string;
  rotulo: string;
  aprop: number;
  /** `null` quando toda a fatia está em exercício de execução aberta. */
  liq: number | null;
  execucao: number | null;
  emApuracao: boolean;
};

/**
 * A supressão é decidida POR FATIA, não pelo recorte inteiro.
 *
 * É o que faz o gráfico de evolução sair certo sem tratamento especial: em
 * `porAno`, a fatia de 2026 nasce com `liq: null` e as de 2024 e 2025 não, então
 * o comparativo mostra três exercícios de planejado e dois de liquidado
 * naturalmente. Nos demais cortes — eixo, órgão, função — a fatia só perde o
 * liquidado se todos os registros dela forem de exercício aberto, que é o caso
 * quando o filtro está em 2026 e nunca quando está em 2024 ou 2025.
 */
function somarPor(
  registros: Registro[],
  chaveDe: (r: Registro) => string,
  rotuloDe: (k: string) => string
): Fatia[] {
  const mapa = new Map<string, Registro[]>();
  for (const r of registros) {
    const k = chaveDe(r);
    const lista = mapa.get(k);
    if (lista) lista.push(r);
    else mapa.set(k, [r]);
  }
  return [...mapa.entries()]
    .map(([k, rs]) => {
      const aprop = rs.reduce((s, r) => s + r.apropOsg, 0);
      const apurando = recorteEmApuracao(rs);
      const liq = apurando ? null : rs.reduce((s, r) => s + r.liqOsg, 0);
      return {
        chave: k,
        rotulo: rotuloDe(k),
        aprop,
        liq,
        execucao: liq !== null && aprop ? (liq / aprop) * 100 : null,
        emApuracao: apurando,
      };
    })
    .sort((a, b) => b.aprop - a.aprop);
}

export const porEixo = (registros: Registro[]) =>
  somarPor(registros, (r) => r.eixo, nomeEixo);

/**
 * Quantas DOTAÇÕES cada eixo tem em cada exercício.
 *
 * Conta dotações, não registros: uma dotação reúne várias entregas, e contar
 * linhas da planilha daria um número maior e sem significado orçamentário. Por
 * isso passa por `agruparEmDotacoes`, que já é a definição de dotação no
 * projeto — e cuja chave inclui o ano, então cada exercício conta o seu.
 *
 * A dotação conta em CADA eixo em que tem entrega, como uma dotação de
 * categorias 2 e 3 aparece nas duas. Por isso a soma dos eixos pode passar do
 * total de dotações do exercício — em 2024, por uma: a SEOP 754/001, ação
 * 11000000, entra no eixo I e no VI.
 */
export function dotacoesPorEixoEAno(registros: Registro[]): {
  anos: number[];
  porEixo: Map<string, Map<number, number>>;
} {
  const anos = [...new Set(registros.map((r) => r.ano))].sort((a, b) => a - b);
  const porEixo = new Map<string, Map<number, number>>();
  for (const d of agruparEmDotacoes(registros)) {
    for (const eixo of d.eixos) {
      let doEixo = porEixo.get(eixo);
      if (!doEixo) {
        doEixo = new Map();
        porEixo.set(eixo, doEixo);
      }
      doEixo.set(d.ano, (doEixo.get(d.ano) ?? 0) + 1);
    }
  }
  return { anos, porEixo };
}

export const porCategoria = (registros: Registro[]) =>
  somarPor(
    registros,
    (r) => String(r.categoria),
    (k) => `Categoria ${k}`
  ).sort((a, b) => Number(a.chave) - Number(b.chave));

export const porFuncao = (registros: Registro[]) =>
  somarPor(registros, (r) => r.funcaoCodigo, nomeFuncao);

/**
 * Maiores órgãos executores, somando todas as unidades de cada um.
 *
 * Por órgão, e não pelo par órgão/unidade: a unidade 001 se chama "UNIDADE
 * GESTORA" em todo órgão, então agrupar por unidade enchia o gráfico de barras
 * homônimas — metade das dez maiores tinha o mesmo rótulo, e não dava para saber
 * de quem era cada uma. Aqui o rótulo precisa identificar a barra sozinho, e a
 * sigla do órgão faz isso. Quem precisa do detalhe por unidade tem a tabela, o
 * filtro e as duas exportações, que trazem os dois em colunas separadas.
 *
 * `siglaCurta` porque o nome canônico do QDD não cabe no eixo de um gráfico de
 * barras.
 */
export const porOrgao = (registros: Registro[], limite?: number) => {
  const nomes = new Map<string, string>();
  for (const r of registros) nomes.set(r.orgaoCodigo, r.orgaoNome);
  const todos = somarPor(
    registros,
    (r) => r.orgaoCodigo,
    (k) => siglaCurta(nomes.get(k) ?? k)
  );
  return limite ? todos.slice(0, limite) : todos;
};

export const porAno = (registros: Registro[]) =>
  somarPor(
    registros,
    (r) => String(r.ano),
    (k) => k
  ).sort((a, b) => Number(a.chave) - Number(b.chave));

export type OpcaoUnidade = {
  /** Par órgão/unidade: `"721/302"`. */
  valor: string;
  /** `"302 FUNDAÇÃO HOSPITAL ESTADUAL DO ACRE- FUNDHACRE"`. */
  rotulo: string;
  /** O mesmo, precedido da sigla do órgão — para quando a lista abrange vários. */
  rotuloComOrgao: string;
};

export type Opcoes = {
  anos: number[];
  eixos: { valor: string; rotulo: string }[];
  categorias: number[];
  orgaos: { valor: string; rotulo: string }[];
  unidades: OpcaoUnidade[];
};

/** Exercícios presentes na base, do mais recente para o mais antigo. */
export const anosDisponiveis = (registros: Registro[]): number[] =>
  [...new Set(registros.map((r) => r.ano))].sort((a, b) => b - a);

/**
 * Opções dos filtros, derivadas do que existe na base (não de listas fixas).
 *
 * `ano` restringe as listas de ÓRGÃO e UNIDADE ao exercício selecionado. Sem
 * isso elas seriam a união dos exercícios, e boa parte das opções devolveria
 * recorte vazio: 9 dos 19 órgãos e 23 das 35 unidades não existem nos três anos
 * — a SEAD só aparece em 2024, a PGE só em 2026. Oferecer um órgão que zera o
 * painel sem dizer por quê é pior do que não oferecê-lo.
 *
 * `anos` continua saindo da base INTEIRA, e não da fatia: derivá-lo do recorte
 * esvaziaria o seletor de exercício assim que um exercício fosse escolhido.
 *
 * Eixo e categoria não são restringidos de propósito. Os seis eixos são a
 * estrutura do art. 4º da Lei 4.168 e valem para todo exercício, gaste-se neles
 * ou não — é a mesma decisão que `GraficoPorEixo` toma ao desenhar os seis na
 * ordem canônica com barra zerada. As três categorias existem em todos os anos.
 */
export function opcoesDeFiltro(
  registros: Registro[],
  ano?: number | null
): Opcoes {
  const anos = anosDisponiveis(registros);
  const doExercicio =
    ano === null || ano === undefined
      ? registros
      : registros.filter((r) => r.ano === ano);

  const eixos = [...new Set(registros.map((r) => r.eixo))]
    .map((e) => ({ valor: e, rotulo: nomeEixo(e) }))
    .sort((a, b) => a.rotulo.localeCompare(b.rotulo, "pt-BR"));
  const categorias = [...new Set(registros.map((r) => r.categoria))].sort();
  /*
    Órgão e unidade são DOIS filtros, e por isso duas listas.

    O órgão é rotulado pela sigla (`"721 SESACRE"`) e não pelo nome canônico: os
    nomes vão de 39 a 74 caracteres e o controle tem uns 250px, então o resumo do
    campo fechado cortaria justamente a parte que identifica. O nome por extenso
    continua na tabela e nas exportações.

    A unidade vem com dois rótulos prontos porque a barra escolhe entre eles: com
    a lista restrita a um órgão, "001 UNIDADE GESTORA" basta; abrangendo vários,
    o mesmo texto apareceria onze vezes seguidas — é o nome da Unidade Gestora em
    onze órgãos — e aí a sigla na frente é o que distingue uma linha da outra.
  */
  const nomesOrgao = new Map<string, string>();
  const porPar = new Map<string, OpcaoUnidade>();
  for (const r of doExercicio) {
    if (!nomesOrgao.has(r.orgaoCodigo))
      nomesOrgao.set(r.orgaoCodigo, r.orgaoNome);
    const par = chaveUnidade(r.orgaoCodigo, r.unidadeCodigo);
    if (porPar.has(par)) continue;
    const daUnidade = r.unidadeNome
      ? `${r.unidadeCodigo} ${r.unidadeNome}`
      : r.unidadeCodigo || par;
    porPar.set(par, {
      valor: par,
      rotulo: daUnidade,
      rotuloComOrgao: `${siglaCurta(r.orgaoNome) || r.orgaoCodigo} · ${daUnidade}`,
    });
  }
  const orgaos = [...nomesOrgao]
    .map(([valor, nome]) => ({
      valor,
      rotulo: `${valor} ${siglaCurta(nome)}`.trim(),
    }))
    .sort((a, b) => a.rotulo.localeCompare(b.rotulo, "pt-BR"));
  const unidades = [...porPar.values()].sort((a, b) =>
    a.rotuloComOrgao.localeCompare(b.rotuloComOrgao, "pt-BR")
  );
  return { anos, eixos, categorias, orgaos, unidades };
}

export type Reconciliacao = {
  filtros: Filtros;
  /**
   * Códigos dos órgãos retirados. Quem chama resolve o nome nas opções do
   * exercício de ONDE se saiu — nas do exercício novo eles não existem mais, que
   * é a razão de terem saído.
   */
  orgaosRemovidos: string[];
  unidadesRemovidas: number;
};

/**
 * Retira da seleção os órgãos e unidades que não existem nas opções dadas.
 *
 * Serve à troca de exercício. Sem ela, quem estava vendo a SEAD em 2024 e muda
 * para 2026 fica com um filtro cuja opção sumiu da lista mas continua filtrando:
 * `filtrar` devolve vazio, o `MultiSelect` degrada o rótulo para "1 selecionado"
 * e o contador do botão "Limpar" segue contando o item invisível. O painel fica
 * em branco sem nada na tela explicando por quê.
 *
 * Devolve também o que saiu, porque a poda precisa ser dita: filtro vazio quer
 * dizer "todos" em `filtrar`, então retirar a última seleção ALARGA o recorte, e
 * os números mudariam mais do que se espera de uma troca de ano.
 *
 * Poda parcial é preservada: das duas secretarias marcadas, sai só a que sumiu.
 */
export function reconciliarFiltros(f: Filtros, opcoes: Opcoes): Reconciliacao {
  const codigos = new Set(opcoes.orgaos.map((o) => o.valor));
  const pares = new Set(opcoes.unidades.map((u) => u.valor));

  const orgaos = f.orgaos.filter((o) => codigos.has(o));
  const unidades = f.unidades.filter((u) => pares.has(u));

  const orgaosRemovidos = f.orgaos.filter((o) => !codigos.has(o));

  return {
    filtros:
      orgaos.length === f.orgaos.length && unidades.length === f.unidades.length
        ? f
        : { ...f, orgaos, unidades },
    orgaosRemovidos,
    unidadesRemovidas: f.unidades.length - unidades.length,
  };
}

export function filtrar(registros: Registro[], f: Filtros): Registro[] {
  const busca = chave(f.busca);
  return registros.filter((r) => {
    if (f.ano !== null && r.ano !== f.ano) return false;
    if (f.eixos.length && !f.eixos.includes(r.eixo)) return false;
    if (f.categorias.length && !f.categorias.includes(r.categoria)) return false;
    if (f.orgaos.length && !f.orgaos.includes(r.orgaoCodigo)) return false;
    if (
      f.unidades.length &&
      !f.unidades.includes(chaveUnidade(r.orgaoCodigo, r.unidadeCodigo))
    )
      return false;
    if (busca) {
      const alvo = chave(
        `${r.aplicacaoProgramada} ${r.entrega} ${r.orgaoCodigo} ${r.orgaoNome} ${r.unidadeCodigo} ${r.unidadeNome} ${r.projetoAtividade} ${r.programaCodigo}`
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
    f.unidades.length +
    (f.busca.trim() ? 1 : 0)
  );
}
