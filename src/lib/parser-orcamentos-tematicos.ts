import { ehEmendaParlamentar, indexarQdd, linhasDoQdd } from "./agregacoes";
import { hashId } from "./id";
import { catalogoDeQdd, limparNome, type CatalogoOrgaos } from "./orgaos";
import {
  acharCabecalho,
  centavos,
  mapearColunas,
  numero,
  numeroOuNulo,
  repartir,
  texto,
  type Aviso,
} from "./parser-comum";
import { normalizarEixo, ponderadorDe } from "./referencias";
import type { DotacaoQdd, OrigemPlanejado, Registro } from "./types";

/**
 * Relatório do Sistema de Orçamentos Temáticos — a fonte dos registros do OSG a
 * partir do exercício de 2026, substituindo a planilha manual `Tabela_OSG`.
 *
 * ## O que muda em relação à fonte antiga
 *
 * **A granularidade do valor.** A Tabela OSG trazia uma linha por entrega, cada
 * uma já com o seu valor apropriado. Aqui o `Planejado ponderado` é da DOTAÇÃO
 * inteira e aparece uma única vez, na primeira linha do grupo; as linhas
 * seguintes repetem as dimensões e só acrescentam a entrega. Só a categoria 2
 * discrimina valor por entrega, na coluna `Planejado da Entrega`.
 *
 * **Órgão e unidade chegam separados e corretos.** A planilha antiga fundia os
 * dois numa string (`"721/302 - FUNDHACRE"`) e às vezes registrava o executor da
 * entrega em vez da unidade da dotação, o que obrigou o `resolverUnidade` a
 * reconstruir o par contra o QDD. Aqui os códigos vêm em colunas próprias e
 * conferem com o QDD nos 121 grupos de 2026 — a resolução não é necessária. Os
 * NOMES, esses, continuam quebrados pelo relatório de origem ("MEIO AMBIEN TE",
 * "PENITEN- CIÁRIA"), então o QDD segue sendo a fonte deles quando carregado.
 *
 * **O valor já vem ponderado.** Conferido contra o QDD 2026: `Planejado
 * ponderado ÷ dotação inicial` dá exatamente 0,500 nas 53 dotações da categoria
 * 3 e 1,000 nas 14 da categoria 1 que não são emenda parlamentar. O
 * `Ponderador` da planilha é metadado, não um fator a aplicar — multiplicar por
 * ele aqui reduziria o exercício à metade.
 */

/** Colunas do relatório, na ordem em que o sistema as emite. */
export const COLUNAS_OT = [
  "Tema",
  "Código secretaria",
  "Secretaria",
  "Código unidade",
  "Unidade",
  "Código ação",
  "Ação",
  "Programa funcional",
  "Eixo",
  "Classificação",
  "Ponderador",
  "Ciclo",
  "Ano",
  "Planejado ponderado",
  "Liquidado temático",
  "Planejado da Entrega",
  "Total de entregas",
  "Entrega (nome)",
  "Descrição da entrega",
  "Quantidade",
  "Município",
  "Público beneficiado",
] as const;

const ALIASES_OT: Record<string, string[]> = {
  Tema: ["tema", "orcamento tematico"],
  "Código secretaria": ["codigo secretaria", "cod secretaria", "codigo orgao"],
  Secretaria: ["secretaria", "orgao"],
  "Código unidade": ["codigo unidade", "cod unidade"],
  Unidade: ["unidade", "unidade orcamentaria"],
  "Código ação": ["codigo acao", "cod acao", "projeto atividade"],
  "Ação": ["acao", "aplicacao programada"],
  "Programa funcional": ["programa funcional", "funcao programatica"],
  Eixo: ["eixo", "eixo do osg", "eixo osg"],
  "Classificação": ["classificacao", "categoria"],
  Ponderador: ["ponderador", "peso"],
  Ciclo: ["ciclo"],
  Ano: ["ano", "exercicio"],
  "Planejado ponderado": ["planejado ponderado", "planejado"],
  "Liquidado temático": ["liquidado tematico", "liquidado"],
  "Planejado da Entrega": ["planejado da entrega", "planejado entrega"],
  "Total de entregas": ["total de entregas", "total entregas"],
  "Entrega (nome)": ["entrega nome", "entrega", "nome da entrega"],
  "Descrição da entrega": ["descricao da entrega", "descricao entrega"],
  Quantidade: ["quantidade", "qtd"],
  "Município": ["municipio"],
  "Público beneficiado": ["publico beneficiado", "publico"],
};

/** O tema que este painel apura. As demais linhas são recusadas. */
const TEMA_ESPERADO = "OSG";

export type ResultadoOT = {
  registros: Registro[];
  totalLinhas: number;
  dotacoes: number;
  anos: number[];
  ciclos: string[];
  totalPlanejado: number;
  totalLiquidado: number;
  /** Dotações que casaram com o QDD do exercício, e o total conferido. */
  casadasComQdd: number;
  /**
   * Emendas parlamentares cujo planejado foi recuperado da dotação atualizada do
   * QDD, e quanto somam. É o que se confere na prévia depois de cada atualização
   * do QDD, sem precisar abrir o banco.
   */
  emendasDerivadas: number;
  totalDerivado: number;
  colunasEncontradas: Record<string, boolean>;
  avisos: Aviso[];
};

type Bruto = {
  linhaPlanilha: number;
  tema: string;
  ano: number;
  orgaoCodigo: string;
  orgaoNomePlanilha: string;
  unidadeCodigo: string;
  unidadeNomePlanilha: string;
  projetoAtividade: string;
  aplicacaoProgramada: string;
  funcaoProgramatica: string;
  eixoBruto: string;
  classificacaoBruta: string;
  categoria: number;
  ponderador: number | null;
  ciclo: string;
  planejadoDotacao: number | null;
  liqDotacao: number | null;
  planejadoEntrega: number | null;
  totalEntregas: number | null;
  entrega: string;
  entregaDescricao: string;
  quantidade: number;
  municipio: string;
  publicoBeneficiado: string;
};

/** `CATEGORIA_2`, `Categoria 2` ou `2` — todos viram 2. */
function lerClassificacao(bruto: string): number {
  const m = bruto.match(/(\d+)\s*$/);
  return m ? Number(m[1]) : 0;
}

/** Código do QDD: três dígitos, com o zero à esquerda que a planilha às vezes perde. */
const codigo = (v: unknown, tamanho: number): string => {
  const t = texto(v).replace(/\D/g, "");
  return t ? t.padStart(tamanho, "0") : "";
};

export function parseOrcamentosTematicos(
  linhas: unknown[][],
  qdd: DotacaoQdd[] = []
): ResultadoOT {
  const avisos: Aviso[] = [];
  const vazio: ResultadoOT = {
    registros: [],
    totalLinhas: 0,
    dotacoes: 0,
    anos: [],
    ciclos: [],
    totalPlanejado: 0,
    totalLiquidado: 0,
    casadasComQdd: 0,
    emendasDerivadas: 0,
    totalDerivado: 0,
    colunasEncontradas: Object.fromEntries(COLUNAS_OT.map((c) => [c, false])),
    avisos,
  };

  // `Planejado ponderado` é o que separa esta planilha da Tabela OSG, que também
  // tem `Eixo` e `Ano`.
  const cabecalhoIdx = acharCabecalho(linhas, [
    ["tema"],
    ["classificacao", "categoria"],
    ["planejado ponderado"],
  ]);
  if (cabecalhoIdx < 0) {
    avisos.push({
      nivel: "erro",
      mensagem:
        "Não encontrei o cabeçalho do relatório. Esperava uma linha com as " +
        "colunas Tema, Classificação e Planejado ponderado.",
      linhas: [],
    });
    return vazio;
  }

  const mapa = mapearColunas(linhas[cabecalhoIdx] ?? [], COLUNAS_OT, ALIASES_OT);
  const colunasEncontradas = Object.fromEntries(
    COLUNAS_OT.map((c) => [c, mapa.has(c)])
  );
  const col = (linha: unknown[], nome: string): unknown => {
    const i = mapa.get(nome);
    return i === undefined ? "" : linha[i];
  };

  const faltando = COLUNAS_OT.filter(
    (c) => !mapa.has(c) && !["Município", "Público beneficiado", "Quantidade"].includes(c)
  );
  if (faltando.length) {
    avisos.push({
      nivel: "erro",
      mensagem: `Colunas obrigatórias ausentes: ${faltando.join(", ")}.`,
      linhas: [],
    });
    return { ...vazio, colunasEncontradas };
  }

  // ---- Passada 1: leitura ----
  const brutos: Bruto[] = [];
  for (let i = cabecalhoIdx + 1; i < linhas.length; i++) {
    const linha = linhas[i] ?? [];
    const ano = Math.trunc(numero(col(linha, "Ano")));
    const projeto = texto(col(linha, "Código ação"));
    const entrega = texto(col(linha, "Entrega (nome)"));
    // Linha vazia ou de totalização.
    if (!ano || (!projeto && !entrega)) continue;

    const classificacaoBruta = texto(col(linha, "Classificação"));
    brutos.push({
      linhaPlanilha: i + 1,
      tema: texto(col(linha, "Tema")),
      ano,
      orgaoCodigo: codigo(col(linha, "Código secretaria"), 3),
      orgaoNomePlanilha: limparNome(texto(col(linha, "Secretaria"))),
      unidadeCodigo: codigo(col(linha, "Código unidade"), 3),
      unidadeNomePlanilha: limparNome(texto(col(linha, "Unidade"))),
      projetoAtividade: projeto,
      aplicacaoProgramada: texto(col(linha, "Ação")),
      funcaoProgramatica: texto(col(linha, "Programa funcional")).replace(/\D/g, ""),
      eixoBruto: texto(col(linha, "Eixo")),
      classificacaoBruta,
      categoria: lerClassificacao(classificacaoBruta),
      ponderador: numeroOuNulo(col(linha, "Ponderador")),
      ciclo: texto(col(linha, "Ciclo")),
      planejadoDotacao: numeroOuNulo(col(linha, "Planejado ponderado")),
      liqDotacao: numeroOuNulo(col(linha, "Liquidado temático")),
      planejadoEntrega: numeroOuNulo(col(linha, "Planejado da Entrega")),
      totalEntregas: numeroOuNulo(col(linha, "Total de entregas")),
      entrega,
      entregaDescricao: texto(col(linha, "Descrição da entrega")),
      quantidade: numero(col(linha, "Quantidade")),
      municipio: texto(col(linha, "Município")),
      publicoBeneficiado: texto(col(linha, "Público beneficiado")),
    });
  }

  if (!brutos.length) {
    avisos.push({ nivel: "erro", mensagem: "Nenhuma linha de dados.", linhas: [] });
    return { ...vazio, colunasEncontradas };
  }

  // ---- Agrupamento em dotações ----
  // A unidade entra na chave: cinco ações de 2026 existem em duas unidades do
  // mesmo órgão (a 13460000 na 719/001 e na 719/637, entre outras), com valores
  // diferentes. Sem ela, duas dotações distintas virariam uma.
  const grupos = new Map<string, Bruto[]>();
  for (const b of brutos) {
    const k = `${b.ano}|${b.orgaoCodigo}/${b.unidadeCodigo}|${b.projetoAtividade}`;
    const lista = grupos.get(k);
    if (lista) lista.push(b);
    else grupos.set(k, [b]);
  }

  // ---- Checagens ----
  const juntar = (nivel: Aviso["nivel"], mensagem: string, linhas: number[]) => {
    if (linhas.length) avisos.push({ nivel, mensagem, linhas });
  };

  juntar(
    "erro",
    `Linhas de outro orçamento temático que não o ${TEMA_ESPERADO}. Este painel ` +
      `apura apenas o ${TEMA_ESPERADO}; as linhas não foram importadas.`,
    brutos.filter((b) => b.tema && b.tema.toUpperCase() !== TEMA_ESPERADO).map((b) => b.linhaPlanilha)
  );
  juntar(
    "erro",
    "Classificação fora de CATEGORIA_1, CATEGORIA_2 ou CATEGORIA_3.",
    brutos.filter((b) => ![1, 2, 3].includes(b.categoria)).map((b) => b.linhaPlanilha)
  );
  juntar(
    "erro",
    "Eixo não reconhecido. Gravado com um identificador improvisado, o que o " +
      "separa dos eixos dos outros exercícios nos filtros e nos gráficos.",
    brutos
      .filter((b) => b.eixoBruto && !normalizarEixo(b.eixoBruto))
      .map((b) => b.linhaPlanilha)
  );
  juntar(
    "aviso",
    "Ponderador em desacordo com a classificação (categoria 1 pondera por 1, " +
      "categoria 3 por 0,5 e categoria 2 não pondera). Valeu o da planilha.",
    brutos
      .filter((b) => b.ponderador !== null && b.ponderador !== ponderadorDe(b.categoria))
      .map((b) => b.linhaPlanilha)
  );
  juntar(
    "aviso",
    "\"Programa funcional\" não tem 17 dígitos ou os 8 últimos não conferem com " +
      "o \"Código ação\". Função e programa saem daí, então saem errados.",
    brutos
      .filter(
        (b) =>
          b.funcaoProgramatica.length !== 17 ||
          b.funcaoProgramatica.slice(9) !== b.projetoAtividade
      )
      .map((b) => b.linhaPlanilha)
  );
  juntar(
    "aviso",
    "\"Planejado da Entrega\" preenchido fora da categoria 2. Nessas linhas o " +
      "valor não vem ponderado e discorda do planejado da dotação, então foi " +
      "ignorado: o valor da entrega saiu do rateio do planejado da dotação.",
    brutos
      .filter((b) => b.categoria !== 2 && b.planejadoEntrega !== null)
      .map((b) => b.linhaPlanilha)
  );

  const valoresForaDaPrimeira: number[] = [];
  const totalEntregasDivergente: number[] = [];
  const somaEntregasDivergente: number[] = [];

  for (const rs of grupos.values()) {
    const [primeira, ...resto] = rs;
    for (const b of resto) {
      if (b.planejadoDotacao !== null || b.liqDotacao !== null || b.totalEntregas !== null)
        valoresForaDaPrimeira.push(b.linhaPlanilha);
    }
    if (primeira.totalEntregas !== null && primeira.totalEntregas !== rs.length)
      totalEntregasDivergente.push(primeira.linhaPlanilha);

    const pp = primeira.planejadoDotacao ?? 0;
    if (primeira.categoria === 2) {
      const soma = rs.reduce((s, b) => s + (b.planejadoEntrega ?? 0), 0);
      if (Math.abs(soma - pp) > 0.01) somaEntregasDivergente.push(primeira.linhaPlanilha);
    }
  }

  juntar(
    "erro",
    "Planejado, liquidado ou total de entregas fora da primeira linha da " +
      "dotação. O relatório os informa uma vez por dotação; se aparecem repetidos, " +
      "o layout mudou e o total do exercício não pode ser confiado.",
    valoresForaDaPrimeira
  );
  juntar(
    "aviso",
    "\"Total de entregas\" diferente do número de linhas da dotação.",
    totalEntregasDivergente
  );
  juntar(
    "aviso",
    "Na categoria 2, a soma do \"Planejado da Entrega\" não fecha com o " +
      "\"Planejado ponderado\" da dotação. O valor das entregas saiu do rateio do " +
      "planejado da dotação, para que o total do exercício continue correto.",
    somaEntregasDivergente
  );
  juntar(
    "aviso",
    "Valores com fração de centavo, que a coluna do banco não armazena. Foram " +
      "arredondados com a metade para o par, que preserva o total do exercício.",
    brutos
      .filter((b) => {
        const v = b.planejadoDotacao;
        return v !== null && Math.abs(Number((v * 100).toFixed(6)) % 1) > 1e-9;
      })
      .map((b) => b.linhaPlanilha)
  );

  // ---- Órgão e unidade contra o QDD do exercício ----
  const anos = [...new Set(brutos.map((b) => b.ano))].sort();
  const qddDoExercicio = qdd.filter((d) => anos.includes(d.ano));
  const catalogo: CatalogoOrgaos = catalogoDeQdd(qddDoExercicio);
  const paresDoQdd = new Set(
    qddDoExercicio.map((d) => `${d.ano}|${d.orgaoCodigo}/${d.unidadeCodigo}`)
  );
  const chavesDoQdd = new Set(
    qddDoExercicio.map(
      (d) => `${d.ano}|${d.orgaoCodigo}/${d.unidadeCodigo}|${d.projetoAtividade}`
    )
  );

  let casadasComQdd = 0;
  if (!qddDoExercicio.length) {
    avisos.push({
      nivel: "aviso",
      mensagem:
        `Nenhum QDD carregado para ${anos.join(", ")}. Os registros são gravados ` +
        "normalmente, mas até o QDD do exercício ser importado o painel não " +
        "calcula a participação do OSG na dotação nem mostra as fontes de " +
        "recurso, e os nomes de órgão e unidade ficam como o relatório os escreve.",
      linhas: [],
    });
  } else {
    const semPar: number[] = [];
    for (const [k, rs] of grupos) {
      if (chavesDoQdd.has(k)) casadasComQdd++;
      const [ano, par] = k.split("|");
      if (!paresDoQdd.has(`${ano}|${par}`)) semPar.push(rs[0].linhaPlanilha);
    }
    juntar(
      "aviso",
      "Par órgão/unidade que não existe no QDD do exercício. A dotação é gravada, " +
        "mas não vai casar com o QDD no painel.",
      semPar
    );
  }

  // ---- Emendas parlamentares: planejado pela dotação atualizada ----
  //
  // Emenda entra na LOA com dotação inicial zerada por construção — só recebe
  // valor depois da alocação dos planos de trabalho dos parlamentares, e isso
  // aparece na dotação atualizada. O Sistema de Orçamentos Temáticos calcula o
  // planejado sobre a inicial, então reporta zero para todas elas. Aqui o valor
  // é recuperado do QDD, que é o mesmo tratamento que 2024 e 2025 dão — lá o
  // COSG preenchia o valor à mão, e `baseDotacao` já usa a atualizada como
  // denominador quando a dotação é emenda.
  //
  // Só onde o relatório reporta ZERO. Se o COSG apurou um valor para a emenda,
  // esse valor vence: foi decisão de apuração, e sobrescrevê-la em silêncio
  // seria pior do que o problema que isto resolve. O caso divergente vira aviso.
  //
  // Cuidado que a regra já resolve sozinha: nem toda dotação de planejado zero é
  // emenda. A 719/637 ação 13460000 tem inicial zero porque sua única fonte é
  // superávit (27130700, transferência fundo a fundo do FSP) — a dotação inicial
  // dela é essa mesmo, e `ehEmendaParlamentar` corretamente não a alcança.
  const indice = qddDoExercicio.length ? indexarQdd(qddDoExercicio) : null;
  const atualizadaDe = (b: Bruto): number =>
    indice
      ? linhasDoQdd(
          {
            ano: b.ano,
            orgaoCodigo: b.orgaoCodigo,
            unidadeCodigo: b.unidadeCodigo,
            projetoAtividade: b.projetoAtividade,
          },
          indice
        ).linhas.reduce((s, l) => s + l.dotacaoAtualizada, 0)
      : 0;

  const derivadas = new Map<string, number>();
  const emendaSemAtualizada: number[] = [];
  const emendaComValorProprio: number[] = [];

  for (const [k, rs] of grupos) {
    const b = rs[0];
    if (!ehEmendaParlamentar(b)) continue;
    const informado = b.planejadoDotacao ?? 0;
    const atualizada = atualizadaDe(b);

    if (informado > 0) {
      // O relatório apurou um valor. Fica como está; só se avisa quando ele
      // destoa da dotação atualizada, para o COSG olhar.
      if (atualizada > 0 && Math.abs(informado - atualizada * (b.ponderador ?? 1)) > 0.01)
        emendaComValorProprio.push(b.linhaPlanilha);
      continue;
    }
    const derivado = atualizada * (b.ponderador ?? 1);
    if (derivado > 0) derivadas.set(k, derivado);
    else emendaSemAtualizada.push(b.linhaPlanilha);
  }

  juntar(
    "aviso",
    `Emendas parlamentares com planejado zerado no relatório: o valor foi ` +
      `recuperado da dotação atualizada do QDD, que é onde a alocação dos planos ` +
      `de trabalho aparece. Como o QDD muda ao longo do exercício, reimporte este ` +
      `relatório sempre que atualizar o QDD.`,
    [...grupos].filter(([k]) => derivadas.has(k)).map(([, rs]) => rs[0].linhaPlanilha)
  );
  juntar(
    "aviso",
    "Emendas parlamentares que continuam zeradas: o relatório não informa valor e " +
      "a dotação atualizada do QDD também está em zero. Recebem valor quando o " +
      "plano de trabalho for alocado.",
    emendaSemAtualizada
  );
  juntar(
    "aviso",
    "Emenda parlamentar com planejado próprio no relatório, diferente da dotação " +
      "atualizada do QDD. O valor do relatório foi mantido — vale conferir qual dos " +
      "dois está certo.",
    emendaComValorProprio
  );

  // Os dois avisos abaixo dependem do planejado FINAL, então rodam depois da
  // derivação. Rodando antes, eles acusariam as emendas que acabaram de receber
  // valor e dariam à prévia um retrato que não é o do que vai ser gravado.
  const planejadoFinalDe = (k: string, b: Bruto): number =>
    derivadas.get(k) ?? b.planejadoDotacao ?? 0;

  const aindaZerado: number[] = [];
  const liquidadoMaiorQuePlanejado: number[] = [];
  for (const [k, rs] of grupos) {
    const b = rs[0];
    const pp = planejadoFinalDe(k, b);
    if (pp === 0 && !ehEmendaParlamentar(b)) aindaZerado.push(b.linhaPlanilha);
    if ((b.liqDotacao ?? 0) > pp + 0.01) liquidadoMaiorQuePlanejado.push(b.linhaPlanilha);
  }

  juntar(
    "aviso",
    "Dotações com planejado igual a zero que NÃO são emenda parlamentar. A " +
      "dotação inicial da LOA é zero mesmo — costuma ser ação financiada só por " +
      "superávit ou por transferência que entra durante o exercício. Entram no " +
      "painel valendo R$ 0,00; vale conferir com o COSG se é o esperado.",
    aindaZerado
  );
  juntar(
    "aviso",
    "Dotações em que o liquidado supera o planejado. É o efeito de medir o " +
      "planejado sobre a LOA e o liquidado sobre a execução corrente, que já " +
      "incorpora suplementações. É também o motivo de a execução deste exercício " +
      "não ser exibida no painel enquanto o ano não fechar.",
    liquidadoMaiorQuePlanejado
  );

  // ---- Passada 2: materialização ----
  const registros: Registro[] = [];
  const ordinal = new Map<string, number>();

  for (const [chaveGrupo, rs] of grupos) {
    const primeira = rs[0];
    const derivado = derivadas.get(chaveGrupo);
    const planejadoOrigem: OrigemPlanejado =
      derivado === undefined ? "relatorio" : "dotacao-atualizada";
    // Gravados já na precisão da coluna do banco, para que o valor da dotação
    // seja exatamente a soma das entregas e não uma segunda versão do total.
    const planejadoDotacao =
      centavos(derivado ?? primeira.planejadoDotacao ?? 0) / 100;
    const liqDotacao = centavos(primeira.liqDotacao ?? 0) / 100;

    // O gatilho do rateio é a CATEGORIA, nunca a presença do "Planejado da
    // Entrega": nas linhas em que ele aparece fora da categoria 2 o valor não
    // vem ponderado, e usá-lo estouraria o total da dotação.
    const somaEntregas = rs.reduce((s, b) => s + (b.planejadoEntrega ?? 0), 0);
    const discriminado =
      primeira.categoria === 2 &&
      rs.every((b) => b.planejadoEntrega !== null) &&
      Math.abs(somaEntregas - planejadoDotacao) <= 0.01;

    const planejados = discriminado
      ? rs.map((b) => b.planejadoEntrega ?? 0)
      : repartir(planejadoDotacao, rs.length);
    // O liquidado acompanha a proporção do planejado; sem planejado, divide igual.
    const liquidados = repartir(liqDotacao, rs.length, planejados);

    rs.forEach((b, i) => {
      const chaveId = `${b.ano}|${b.orgaoCodigo}/${b.unidadeCodigo}|${b.projetoAtividade}`;
      const n = (ordinal.get(chaveId) ?? 0) + 1;
      ordinal.set(chaveId, n);

      const eixo = normalizarEixo(b.eixoBruto);
      const pf = b.funcaoProgramatica;

      registros.push({
        // O prefixo marca a fonte: um registro de 2026 nunca colide com um id
        // gerado pelo parser da Tabela OSG, mesmo com o mesmo conteúdo. A
        // descrição entra na chave porque o nome da entrega se repete dentro da
        // dotação — duas "Locação de mão de obra" na PGE, distinguidas só ali.
        id: hashId(
          "ot",
          b.ano,
          b.orgaoCodigo,
          b.unidadeCodigo,
          b.projetoAtividade,
          b.categoria,
          b.entrega,
          b.entregaDescricao,
          n
        ),
        ano: b.ano,
        categoria: b.categoria,
        orgaoCodigo: b.orgaoCodigo,
        orgaoNome: catalogo.orgaos.get(b.orgaoCodigo) || b.orgaoNomePlanilha,
        unidadeCodigo: b.unidadeCodigo,
        unidadeNome:
          catalogo.unidades.get(`${b.orgaoCodigo}/${b.unidadeCodigo}`) ||
          b.unidadeNomePlanilha,
        aplicacaoProgramada: b.aplicacaoProgramada,
        projetoAtividade: b.projetoAtividade,
        // Os 17 dígitos são função(2) + subfunção(3) + programa(4) + ação(8).
        funcaoCodigo: pf.length === 17 ? pf.slice(0, 2) : "",
        programaCodigo: pf.length === 17 ? pf.slice(5, 9) : "",
        eixo: eixo ?? b.eixoBruto.toLowerCase().replace(/[\s_]+/g, "-"),
        entrega: b.entrega,

        apropOsg: planejados[i],
        liqOsg: liquidados[i],

        // O relatório não traz o orçamento da ação inteira — quem tem isso é o
        // QDD, que o painel já consulta por (exercício, órgão/unidade, projeto).
        // Deixar zerado é o que faz `baseDotacao` buscar lá em vez de usar um
        // número da planilha; preencher com o planejado do OSG faria toda
        // dotação de 2026 exibir "participação de 100%" silenciosamente.
        orcAprovado: 0,
        orcFinal: 0,
        liqProjeto: 0,
        aLiquidar: 0,
        orcAprovadoProjeto: 0,
        orcFinalProjeto: 0,
        liqProjetoTotal: 0,

        tema: b.tema || TEMA_ESPERADO,
        ciclo: b.ciclo,
        ponderador: b.ponderador ?? ponderadorDe(b.categoria),
        planejadoDotacao,
        planejadoOrigem,
        // Nulo quando o valor da entrega é rateio, e não número da fonte.
        planejadoEntrega: discriminado ? b.planejadoEntrega : null,
        liqDotacao,
        funcaoProgramatica: pf,
        entregaDescricao: b.entregaDescricao,
        quantidade: b.quantidade,
        municipio: b.municipio,
        publicoBeneficiado: b.publicoBeneficiado,
      });
    });
  }

  const totalPlanejado = registros.reduce((s, r) => s + r.apropOsg, 0);
  const totalLiquidado = registros.reduce((s, r) => s + r.liqOsg, 0);

  return {
    registros,
    totalLinhas: brutos.length,
    dotacoes: grupos.size,
    anos,
    ciclos: [...new Set(brutos.map((b) => b.ciclo).filter(Boolean))],
    totalPlanejado,
    totalLiquidado,
    casadasComQdd,
    emendasDerivadas: derivadas.size,
    totalDerivado: [...derivadas.values()].reduce((s, v) => s + v, 0),
    colunasEncontradas,
    avisos,
  };
}
