import {
  agruparEmDotacoes,
  anotacaoDotacao,
  fontesDaDotacao,
  linhasDoQdd,
  pesoNaDotacao,
  rotuloBase,
  rotuloOrigemQdd,
  subfuncoesDaDotacao,
  veioDoQdd,
  type IndiceQdd,
} from "./agregacoes";
import { EQUIPE_DEPPO, METODOLOGIA_PARTES, NOTA_EM_APURACAO } from "./conteudo";
import { siglaCurta } from "./orgaos";
import { moeda, percentual } from "./formato";
import {
  descricaoFonte,
  descricaoFuncao,
  descricaoPrograma,
  descricaoSubfuncao,
  eixoPpa,
  emApuracao,
  nomeEixo,
} from "./referencias";
import type { Filtros, Registro, Totais } from "./types";

/**
 * Exportações do painel. As duas respeitam o recorte na tela: o que sai é
 * exatamente o que está filtrado, e o cabeçalho registra quais filtros estavam
 * ativos — sem isso um arquivo solto vira um número sem procedência.
 *
 * `exceljs` e `jspdf` são pesados, então entram por import dinâmico: só são
 * baixados quando alguém realmente clica em exportar.
 */

/**
 * Aplicação programada em caixa alta.
 *
 * A planilha de origem mistura as duas formas — "Urbanização de Orlas do Acre."
 * ao lado de "MANUTENÇÃO DAS ATIVIDADES ADMINISTRATIVAS E OPERACIONAIS" —, e num
 * arquivo publicado a mistura lê como desleixo. Maiúscula uniformiza sem perder
 * sigla, que é o risco do caminho contrário.
 *
 * **Só no PDF.** A planilha passou a preservar o texto da origem: caixa alta é
 * decisão de apresentação, e uma base de dados devolve o dado como ele é — quem
 * for cruzar a coluna com outra planilha compara o texto, não a estética. No
 * documento publicado, que é peça de leitura, o versal continua fazendo sentido.
 */
const emCaixaAlta = (texto: string) => texto.toUpperCase();

const MOEDA_XLSX = '"R$" #,##0.00';
const PCT_XLSX = "0.0%";

function carimbo(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * As fontes padrão do jsPDF são Latin-1: qualquer caractere fora dessa tabela
 * some do PDF em silêncio. O travessão e as aspas curvas aparecem em toda parte
 * nos nossos rótulos ("10 — Saúde"), então tudo que vai para o PDF passa aqui.
 * (Os acentos do português estão em Latin-1 e sobrevivem.)
 */
const SUBSTITUICOES: [RegExp, string][] = [
  [/[\u2013\u2014]/g, "-"],
  [/[\u2018\u2019]/g, "'"],
  [/[\u201c\u201d]/g, '"'],
  [/\u2026/g, "..."],
  [/\u2022/g, "-"],
  [/[\u00a0\u2007\u2009\u202f]/g, " "],
];

function paraPdf(texto: string): string {
  let t = texto;
  for (const [de, para] of SUBSTITUICOES) t = t.replace(de, para);
  // Rede de segurança: o que ainda estiver fora de Latin-1 vira "?" visível,
  // em vez de desaparecer sem deixar rastro.
  return t.replace(/[^\u0000-\u00ff]/g, "?");
}

/**
 * O recorte, em texto, para a aba "Recorte" do XLSX e a capa do PDF.
 *
 * `registros` entra só para dar nome ao que os filtros guardam como código:
 * `f.orgaos` tem `"721"` e `f.unidades`, `"721/302"`. Impressos crus, o recorte
 * viraria uma lista de números. O selecionado que nenhum registro do recorte
 * alcança cai no próprio código, que ainda identifica.
 */
/**
 * Corta o texto no que couber em `largura`, com reticências.
 *
 * `doc` precisa estar com a fonte e o corpo já definidos — a medida depende dos
 * dois. Serve para rótulo que divide a linha com números: os números não podem
 * ser cortados nem encolhidos, então quem cede é o texto.
 */
function encurtarPara(
  doc: { getTextWidth: (t: string) => number },
  texto: string,
  largura: number
): string {
  if (doc.getTextWidth(texto) <= largura) return texto;
  let corte = texto;
  while (corte.length > 1 && doc.getTextWidth(`${corte}…`) > largura) {
    corte = corte.slice(0, -1);
  }
  return `${corte.trimEnd()}…`;
}

function descreverFiltros(f: Filtros, registros: Registro[]): string[] {
  const nomesOrgao = new Map<string, string>();
  const nomesUnidade = new Map<string, string>();
  for (const r of registros) {
    if (!nomesOrgao.has(r.orgaoCodigo))
      nomesOrgao.set(r.orgaoCodigo, `${r.orgaoCodigo} ${r.orgaoNome}`);
    const par = `${r.orgaoCodigo}/${r.unidadeCodigo}`;
    if (!nomesUnidade.has(par) && r.unidadeNome)
      nomesUnidade.set(
        par,
        `${r.orgaoNome} / ${r.unidadeCodigo} ${r.unidadeNome}`
      );
  }
  const linhas: string[] = [];
  linhas.push(`Exercício: ${f.ano ?? "todos"}`);
  linhas.push(
    `Eixos: ${f.eixos.length ? f.eixos.map(nomeEixo).join(", ") : "todos"}`
  );
  linhas.push(
    `Categorias: ${f.categorias.length ? f.categorias.join(", ") : "todas"}`
  );
  linhas.push(
    `Órgãos: ${
      f.orgaos.length
        ? f.orgaos.map((o) => nomesOrgao.get(o) ?? o).join(" · ")
        : "todos"
    }`
  );
  linhas.push(
    `Unidades orçamentárias: ${
      f.unidades.length
        ? f.unidades.map((u) => nomesUnidade.get(u) ?? u).join(" · ")
        : "todas"
    }`
  );
  if (f.busca.trim()) linhas.push(`Busca: "${f.busca.trim()}"`);
  return linhas;
}

/* ------------------------------------------------------------------ *
 * Identidade do PDF institucional
 * ------------------------------------------------------------------ */

/** Verde-escuro da faixa — mesmo RGB do `--verde-escuro` do tema. */
const VERDE_ESCURO: [number, number, number] = [18, 63, 48];
const VERDE_CLARO_FAIXA: [number, number, number] = [232, 240, 235];
const CINZA_ZEBRA: [number, number, number] = [246, 247, 243];

const ALTURA_FAIXA = 74;

/**
 * A marca em data URL, para o `addImage` do jsPDF.
 *
 * **Proporção real do arquivo: 3113x439, ou 7,09:1.** Deformar a marca de um
 * governo num documento publicado não é detalhe — por isso a largura aqui sai
 * sempre da altura multiplicada por essa razão, nunca de um número escolhido a
 * olho.
 *
 * Devolve `null` em qualquer falha: um PDF sem a marca é muito melhor que um
 * botão de exportar que estoura.
 */
const PROPORCAO_MARCA = 3113 / 439;

async function carregarMarca(): Promise<string | null> {
  try {
    const r = await fetch("/logos/seplan-horizontal-branco.png");
    if (!r.ok) return null;
    const blob = await r.blob();
    return await new Promise<string | null>((resolve) => {
      const fr = new FileReader();
      fr.onload = () => resolve(typeof fr.result === "string" ? fr.result : null);
      fr.onerror = () => resolve(null);
      fr.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/**
 * Planilha do recorte, nas duas granularidades que o painel tem — a dotação da
 * tabela detalhada e a entrega dentro dela — mais uma aba de procedência.
 *
 * Três decisões que valem para o arquivo inteiro:
 *
 *  - **Todo valor sai como número**, com formato de moeda ou de porcentagem.
 *    Texto pronto ("R$ 1.234,56") é bonito e inútil: quem recebe a planilha não
 *    consegue somar, ordenar nem cruzar nada em cima dele.
 *  - **Autofiltro nas abas de dados**, porque um recorte com centenas de linhas
 *    e dezenove colunas é para ser vasculhado dentro do Excel.
 *  - **A metodologia viaja junto**, na aba de recorte. O percentual de
 *    participação não quer dizer nada sem saber que a base é a dotação inicial
 *    da LOA — e o arquivo circula sozinho, longe do painel que explica isso.
 */
export async function exportarXlsx(
  registros: Registro[],
  filtros: Filtros,
  totais: Totais,
  qdd: IndiceQdd | null
) {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "SEPLAN/AC — Orçamento Sensível ao Gênero";
  wb.created = new Date();

  const dotacoes = agruparEmDotacoes(registros);

  /*
    Bloco de identificação, repetido nas três abas de dados.

    Código e nome em colunas SEPARADAS. Fundidos numa string só
    ("721 SECRETARIA DE ESTADO DE SAÚDE - SESACRE") não dá para dinamizar por
    código, cruzar com outra base por PROCV nem ordenar numericamente sem antes
    fatiar o texto — e é justamente por código que se cruza planilha de orçamento
    com planilha de orçamento.

    Largura proporcional ao conteúdo medido: o código do órgão tem sempre 3
    caracteres, e o projeto/atividade sempre 8 — ficavam em colunas de 46 e 18.
  */
  const COLUNAS_IDENTIFICACAO = [
    // 10, e não 9: o ExcelJS trata 9 como largura padrão e simplesmente não a
    // escreve no arquivo, e aí o Excel aplica os 8,43 dele. Vale para as três
    // colunas estreitas desta planilha.
    { header: "Exercício", key: "ano", width: 10 },
    { header: "Órgão (cód.)", key: "orgaoCodigo", width: 8 },
    { header: "Órgão", key: "orgaoNome", width: 34 },
    { header: "Unidade (cód.)", key: "unidadeCodigo", width: 10 },
    { header: "Unidade", key: "unidadeNome", width: 34 },
    { header: "Projeto/Atividade", key: "projeto", width: 12 },
    { header: "Aplicação programada", key: "aplicacao", width: 44 },
  ];

  /** Os mesmos campos, para qualquer linha que traga órgão, unidade e projeto. */
  const identificacao = (
    r: Pick<
      Registro,
      | "ano"
      | "orgaoCodigo"
      | "orgaoNome"
      | "unidadeCodigo"
      | "unidadeNome"
      | "projetoAtividade"
      | "aplicacaoProgramada"
    >
  ) => ({
    ano: r.ano,
    orgaoCodigo: r.orgaoCodigo,
    orgaoNome: r.orgaoNome || null,
    unidadeCodigo: r.unidadeCodigo || null,
    unidadeNome: r.unidadeNome || null,
    projeto: r.projetoAtividade || null,
    // Sem caixa alta: a origem escreve "Fortalecimento da rede cegonha" e uma
    // base preserva o texto como ele é. Versal era decisão de relatório.
    aplicacao: r.aplicacaoProgramada || null,
  });

  /*
    Dotações — dimensões, depois medidas, depois qualificadores.

    A ordem não é estética: numa base, tudo que se agrupa fica à esquerda e tudo
    que se soma, à direita, para selecionar um bloco de medidas ser um arrasto só
    e a tabela dinâmica achar as dimensões juntas. Antes as colunas alternavam —
    medidas do OSG, mais duas dimensões, medidas do QDD, mais três dimensões.

    "Eixo do OSG", e não "Eixo": a planilha tem duas classificações com esse nome
    — a de gênero da Lei 4.168/2023 e a temática do PPA — e duas colunas "Eixo"
    com valores diferentes seriam indefensáveis num arquivo que circula sozinho.

    Subfunção e Fontes de recurso continuam em coluna única porque são LISTAS:
    uma dotação tem várias, e separar em código e nome viraria duas listas
    paralelas, que ninguém consegue casar item a item.

    As três colunas de dotação (inicial, atualizada, liquidado) descrevem a ação
    orçamentária inteira, não a parcela do OSG, e se repetem quando duas dotações
    do recorte casam com a mesma ação do QDD — a nota metodológica avisa que não
    devem ser somadas.
  */
  const abaDotacoes = wb.addWorksheet("Dotações");
  abaDotacoes.columns = [
    ...COLUNAS_IDENTIFICACAO,
    { header: "Função (cód.)", key: "funcaoCodigo", width: 8 },
    { header: "Função", key: "funcaoNome", width: 26 },
    { header: "Programa (cód.)", key: "programaCodigo", width: 10 },
    { header: "Programa", key: "programaNome", width: 30 },
    { header: "Subfunção", key: "subfuncao", width: 28 },
    { header: "Eixo do OSG (Lei nº 4.168/2023)", key: "eixo", width: 20 },
    { header: "Eixo do PPA", key: "eixoPpa", width: 26 },
    { header: "Categoria", key: "categoria", width: 10 },
    { header: "Ponderador", key: "ponderador", width: 11 },
    { header: "Origem do planejado", key: "planejadoOrigem", width: 19 },
    { header: "Fontes de recurso", key: "fontes", width: 20 },
    { header: "Valor planejado OSG", key: "aprop", width: 17, style: { numFmt: MOEDA_XLSX } },
    { header: "Liquidado OSG", key: "liq", width: 16, style: { numFmt: MOEDA_XLSX } },
    { header: "Execução (%)", key: "execucao", width: 11, style: { numFmt: PCT_XLSX } },
    { header: "Dotação inicial", key: "dotInicial", width: 16, style: { numFmt: MOEDA_XLSX } },
    { header: "Dotação atualizada", key: "dotAtualizada", width: 17, style: { numFmt: MOEDA_XLSX } },
    { header: "Liquidado da dotação", key: "dotLiquidado", width: 17, style: { numFmt: MOEDA_XLSX } },
    { header: "Participação do OSG na dotação (%)", key: "peso", width: 13, style: { numFmt: PCT_XLSX } },
    { header: "Base do percentual", key: "baseRotulo", width: 18 },
    { header: "Fonte da dotação", key: "dotFonte", width: 15 },
    { header: "Anotação", key: "anotacao", width: 44 },
    { header: "Situação da execução", key: "situacao", width: 20 },
  ];

  for (const d of dotacoes) {
    const peso = pesoNaDotacao(d, qdd);
    const { base } = peso;
    const subfuncoes = subfuncoesDaDotacao(d, qdd);
    // Por código crescente: `fontesDaDotacao` ordena pelo valor da dotação, que
    // é o certo na lista da tela, mas numa célula de códigos separados por
    // vírgula quem lê procura em ordem.
    const fontes = fontesDaDotacao(d, qdd)
      .map((f) => f.fonte)
      .filter(Boolean)
      .sort();
    abaDotacoes.addRow({
      ...identificacao(d),
      funcaoCodigo: d.funcaoCodigo || null,
      funcaoNome: descricaoFuncao(d.funcaoCodigo) || null,
      programaCodigo: d.programaCodigo || null,
      programaNome: descricaoPrograma(d.programaCodigo) || null,
      subfuncao: subfuncoes.length
        ? subfuncoes.map(descricaoSubfuncao).filter(Boolean).join(" · ")
        : null,
      // Lista, como a coluna Categoria: a dotação pode reunir entregas de mais
      // de um eixo. O eixo de cada entrega está, sozinho, na aba "Entregas".
      eixo: d.eixos.map(nomeEixo).join(", "),
      eixoPpa: eixoPpa(d.programaCodigo) || null,
      categoria: d.categorias.join(", "),
      // Nulo na categoria 2, onde não há fator: a apropriação é discriminada
      // caso a caso pelo órgão executor.
      ponderador: d.ponderador,
      // "dotacao-atualizada" marca emenda parlamentar, cujo planejado o relatório
      // reporta como zero e a importação recupera do QDD.
      planejadoOrigem:
        d.planejadoOrigem === "dotacao-atualizada"
          ? "dotação atualizada (emenda)"
          : "relatório",
      // Códigos, não nomes: é por esta coluna que se filtra dentro do Excel, e
      // o nome de cada fonte está por extenso na aba "Fontes de recurso".
      fontes: fontes.length ? fontes.join(", ") : null,
      aprop: d.apropOsg,
      // Célula vazia no exercício em apuração, e não o número: o XLSX é o dado
      // bruto, mas um liquidado parcial numa coluna chamada "Liquidado OSG"
      // seria somado e comparado com exercícios fechados assim que saísse daqui.
      // A situação fica registrada na coluna "Situação da execução".
      liq: emApuracao(d.ano) ? null : d.liqOsg,
      execucao: emApuracao(d.ano) || !d.apropOsg ? null : d.liqOsg / d.apropOsg,
      dotInicial: base.inicial,
      dotAtualizada: base.atualizada,
      dotLiquidado: emApuracao(d.ano) ? null : base.liquidadoProjeto,
      peso: peso.percentual === null ? null : peso.percentual / 100,
      // Célula vazia, e não "—": num arquivo de dados o travessão é um valor de
      // texto como outro qualquer, que suja o filtro e a contagem da coluna.
      baseRotulo: rotuloBase(base) || null,
      dotFonte: veioDoQdd(base.origem)
        ? "QDD"
        : base.origem === "planilha"
          ? "planilha do OSG"
          : "não informada",
      anotacao: anotacaoDotacao(base, moeda) || null,
      situacao: emApuracao(d.ano) ? "Execução em apuração" : "Exercício encerrado",
    });
  }

  /*
    Entregas — a granularidade fina, uma linha por entrega apropriada.

    "Entrega apropriada" vai a 60 e não mais a 80: o texto chega a 898 caracteres
    e nenhuma largura o mostra inteiro, então largura demais só empurra as
    medidas para fora da tela sem resolver nada. Com a quebra de linha desligada
    (ver o bloco de estilo no fim), a linha fica de altura única e o texto
    completo continua na célula, visível na barra de fórmulas.
  */
  const abaEntregas = wb.addWorksheet("Entregas");
  abaEntregas.columns = [
    ...COLUNAS_IDENTIFICACAO,
    { header: "Eixo do OSG (Lei nº 4.168/2023)", key: "eixo", width: 20 },
    { header: "Categoria", key: "categoria", width: 10 },
    { header: "Entrega apropriada", key: "entrega", width: 60 },
    { header: "Descrição da entrega", key: "descricao", width: 60 },
    { header: "Valor planejado OSG", key: "aprop", width: 17, style: { numFmt: MOEDA_XLSX } },
    // Diz se o valor ao lado é número da fonte ou divisão feita na importação.
    // Sem esta coluna, os dois sairiam indistinguíveis na mesma célula.
    { header: "Origem do valor", key: "origemValor", width: 16 },
    { header: "Liquidado OSG", key: "liq", width: 16, style: { numFmt: MOEDA_XLSX } },
    { header: "Município", key: "municipio", width: 18 },
    { header: "Público beneficiado", key: "publico", width: 30 },
  ];

  for (const r of registros) {
    abaEntregas.addRow({
      ...identificacao(r),
      eixo: nomeEixo(r.eixo),
      categoria: r.categoria,
      entrega: r.entrega || null,
      descricao: r.entregaDescricao || null,
      aprop: r.apropOsg,
      origemValor:
        r.planejadoEntrega !== null ? "discriminado" : "rateio da dotação",
      liq: emApuracao(r.ano) ? null : r.liqOsg,
      municipio: r.municipio || null,
      publico: r.publicoBeneficiado || null,
    });
  }

  /*
    Autofiltro sobre o intervalo usado — e nada além disso.

    A linha "TOTAL DO RECORTE" que fechava as abas saiu. Numa base ela atrapalha
    mais do que ajuda: entra no intervalo de qualquer tabela dinâmica feita sobre
    as colunas inteiras, e faz `Ctrl+Shift+seta` parar num lugar que não é o fim
    dos dados. Os totais do recorte estão na aba "Recorte", e dentro do Excel a
    barra de status soma qualquer seleção.

    Ganho de tabela: com o total fora, some o endereçamento de coluna por LETRA
    ("V", "J", "K", "L", "A1:K"), que era escrito à mão e já obrigou a renumerar
    duas vezes ao mexer nas colunas — errar ali somava a coluna errada sem dar
    erro nenhum. O intervalo agora sai de `columnCount`/`rowCount`, e coluna nova
    pode entrar em qualquer posição.
  */
  const ativarAutoFiltro = (aba: import("exceljs").Worksheet) => {
    // Só cabeçalho: não há o que filtrar.
    if (aba.rowCount < 2) return;
    aba.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: aba.rowCount, column: aba.columnCount },
    };
  };

  /*
    Uma linha por (dotação × fonte de recurso).

    É o único lugar do arquivo onde número por fonte pode existir sem mentir: os
    valores são da dotação inteira, vindos do QDD, e não uma fatia do OSG — que
    a planilha de origem não reparte por fonte.

    **Sem linha de total, de propósito.** Quando a dotação casa com o QDD pelo
    recuo por projeto, sem órgão, a mesma linha do QDD atende a dotações de
    órgãos diferentes e aparece repetida aqui; somar a coluna contaria o mesmo
    dinheiro duas vezes. O autofiltro fica, porque filtrar é legítimo; totalizar
    é que não.
  */
  const abaFontes = wb.addWorksheet("Fontes de recurso");
  abaFontes.columns = [
    ...COLUNAS_IDENTIFICACAO,
    { header: "Fonte (cód.)", key: "fonteCodigo", width: 11 },
    { header: "Fonte de recurso", key: "fonteNome", width: 40 },
    { header: "Dotação inicial (fonte)", key: "inicial", width: 17, style: { numFmt: MOEDA_XLSX } },
    { header: "Dotação atualizada (fonte)", key: "atualizada", width: 18, style: { numFmt: MOEDA_XLSX } },
    { header: "Liquidado (fonte)", key: "liquidado", width: 16, style: { numFmt: MOEDA_XLSX } },
    { header: "Participação na dotação (%)", key: "participacao", width: 13, style: { numFmt: PCT_XLSX } },
    { header: "Casamento com o QDD", key: "origem", width: 18 },
  ];

  for (const d of dotacoes) {
    const fontes = fontesDaDotacao(d, qdd);
    if (!fontes.length) continue;
    const origem = linhasDoQdd(d, qdd).origem;
    const totalAtualizada = fontes.reduce((s, f) => s + f.atualizada, 0);
    for (const f of fontes) {
      abaFontes.addRow({
        ...identificacao(d),
        fonteCodigo: f.fonte || null,
        fonteNome: f.fonte
          ? descricaoFonte(f.fonte) || null
          : "não informada no QDD",
        inicial: f.inicial,
        atualizada: f.atualizada,
        liquidado: f.liquidado,
        participacao: totalAtualizada ? f.atualizada / totalAtualizada : null,
        origem: rotuloOrigemQdd(origem),
      });
    }
  }

  /*
    Aba de procedência: de onde veio, com que recorte, quanto dá, como se
    calcula e quem assina. É o que separa uma planilha citável de uma planilha
    solta — e sai do mesmo `METODOLOGIA_PARTES` e `EQUIPE_DEPPO` que o PDF usa,
    para que os dois arquivos não digam coisas diferentes.
  */
  const abaResumo = wb.addWorksheet("Recorte");
  abaResumo.columns = [
    { header: "Item", key: "item", width: 42 },
    { header: "Valor", key: "valor", width: 92 },
  ];
  abaResumo.getColumn("valor").alignment = { wrapText: true, vertical: "top" };

  const resumo = (item: string, valor: unknown, numFmt?: string) => {
    const linha = abaResumo.addRow({ item, valor });
    if (numFmt) linha.getCell("valor").numFmt = numFmt;
    return linha;
  };
  const subtitulo = (texto: string) => {
    const linha = abaResumo.addRow({ item: texto });
    linha.font = { bold: true };
    return linha;
  };

  resumo("Fonte", "DEPPO/SEPLAN — Orçamento Sensível ao Gênero");
  resumo("Gerado em", new Date().toLocaleString("pt-BR"));

  abaResumo.addRow({});
  subtitulo("Parâmetros do recorte");
  for (const linha of descreverFiltros(filtros, registros)) {
    const [item, ...resto] = linha.split(": ");
    resumo(item, resto.join(": "));
  }

  abaResumo.addRow({});
  subtitulo("Totais do recorte");
  // Números, não texto formatado: são os valores que alguém vai conferir contra
  // o painel e reaproveitar em outra planilha.
  resumo("Valor planejado OSG", totais.aprop, MOEDA_XLSX);
  resumo(
    "Liquidado OSG",
    totais.liq,
    totais.liq === null ? undefined : MOEDA_XLSX
  );
  resumo(
    "Execução",
    totais.execucao !== null ? totais.execucao / 100 : null,
    PCT_XLSX
  );
  if (totais.emApuracao)
    resumo("Situação da execução", NOTA_EM_APURACAO.titulo);
  resumo("Dotações", totais.dotacoes);
  resumo("Entregas apropriadas", totais.entregas);
  resumo("Órgãos executores", totais.orgaos);
  resumo("Unidades orçamentárias", totais.unidades);

  abaResumo.addRow({});
  subtitulo("Nota metodológica");
  for (const parte of METODOLOGIA_PARTES) resumo(parte.titulo, parte.texto);
  // Ressalva que só existe no arquivo: no painel cada dotação aparece sozinha
  // na linha aberta, então a soma da coluna nunca se apresenta ao leitor. Aqui
  // a coluna está ali, somável, e a armadilha precisa vir escrita.
  resumo(
    "Sobre as fontes de recurso",
    "Fonte de recurso descreve a ação orçamentária inteira, não a parcela apropriada ao OSG — a planilha de origem não reparte o valor do OSG por fonte, e nada aqui estima essa repartição. Uma dotação costuma ter várias fontes. Os valores por fonte estão na aba \"Fontes de recurso\" e são do QDD."
  );
  resumo(
    "Sobre os dois eixos",
    "A coluna \"Eixo do OSG\" traz os seis eixos do art. 4º da Lei estadual nº 4.168/2023, que organizam o Orçamento Sensível ao Gênero e são os eixos usados no painel. A coluna \"Eixo do PPA\" traz o eixo temático do Plano Plurianual a que o programa pertence. São classificações diferentes, com o mesmo nome."
  );
  resumo(
    "Sobre as colunas de dotação",
    "Dotação inicial, atualizada e liquidado da dotação descrevem a ação orçamentária inteira, não a parcela do OSG. Quando duas dotações do recorte pertencem à mesma ação, o valor se repete nas duas linhas — por isso essas colunas não entram na linha de total e não devem ser somadas."
  );
  // As duas ressalvas abaixo só existem por causa da fonte de 2026 em diante.
  // Ficam no arquivo sempre: quem abre um recorte de 2024 precisa saber por que
  // a coluna "Origem do valor" diz "discriminado" em todas as linhas.
  resumo(
    "Sobre a coluna \"Origem do valor\"",
    "A partir de 2026 o relatório de origem informa o valor planejado no nível da dotação, e só discrimina por entrega nas dotações de categoria 2. Nas demais, o valor de cada entrega é a divisão do valor da dotação pelo número de entregas — marcado como \"rateio da dotação\". A soma das entregas devolve o valor da dotação ao centavo em qualquer dos dois casos."
  );
  resumo(
    "Sobre a coluna \"Origem do planejado\"",
    "Diz de onde veio o valor planejado da dotação. \"Relatório\" é o caso normal — o número foi apurado pelo Comitê. \"Dotação atualizada (emenda)\" marca as emendas parlamentares: elas entram na lei orçamentária com dotação inicial zerada e só recebem valor depois da alocação do plano de trabalho, então o relatório do exercício as reporta como zero e o valor é recuperado da dotação atualizada do QDD. Como o QDD muda ao longo do exercício, esse valor acompanha a data da última importação."
  );
  resumo(
    "Sobre o ponderador",
    "É o fator de apropriação da categoria: 1 na categoria 1 e 0,5 na categoria 3. Fica vazio na categoria 2, onde não há fator — ali o próprio órgão executor discrimina quanto da dotação foi apropriado. O valor planejado já chega ponderado da origem; o ponderador está na planilha para conferência, não para ser aplicado de novo."
  );
  if (totais.emApuracao)
    resumo(NOTA_EM_APURACAO.titulo, NOTA_EM_APURACAO.texto);

  abaResumo.addRow({});
  subtitulo("Equipe");
  resumo(
    "Coordenação",
    EQUIPE_DEPPO.coordenacao.map((p) => `${p.nome} (${p.cargo})`).join(", ")
  );
  resumo(
    "Equipe técnica",
    EQUIPE_DEPPO.tecnica.map((p) => `${p.nome} (${p.cargo})`).join(", ")
  );

  /*
    Quebra de linha SÓ no cabeçalho.

    Era o contrário: as colunas de texto tinham `wrapText`, e como "Entrega
    apropriada" chega a 898 caracteres, cada linha da planilha virava um bloco de
    várias alturas — rolar a aba ficava impraticável e nenhuma linha se alinhava
    com a vizinha. Numa base, uma linha é uma linha; o texto que não cabe fica
    cortado na tela e inteiro na célula, como em qualquer planilha de dados.

    No cabeçalho a quebra é o que permite manter rótulos explícitos
    ("Participação do OSG na dotação (%)") sem alargar a coluna para caber neles.
  */
  for (const aba of [abaDotacoes, abaEntregas, abaFontes]) {
    ativarAutoFiltro(aba);
    aba.getRow(1).alignment = { wrapText: true, vertical: "middle" };
    // xSplit 2, e não só ySplit: com mais de vinte colunas, rolar até as medidas
    // perdia de vista de quem era a linha. Exercício + código do órgão são 17
    // caracteres de contexto, sem comer meia tela.
    aba.views = [{ state: "frozen", xSplit: 2, ySplit: 1 }];
  }
  abaResumo.views = [{ state: "frozen", ySplit: 1 }];
  abaResumo.getRow(1).alignment = { vertical: "middle" };

  for (const aba of [abaDotacoes, abaEntregas, abaFontes, abaResumo]) {
    aba.getRow(1).font = { bold: true };
  }

  const buffer = await wb.xlsx.writeBuffer();
  baixar(
    new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    `osg-acre-${filtros.ano ?? "todos"}-${carimbo()}.xlsx`
  );
}

/**
 * PDF institucional: faixa da SEPLAN em toda página, um bloco por órgão com
 * subtotal, total geral, nota metodológica e a assinatura do DEPPO.
 *
 * Retrato de propósito. A coluna "Órgão" saiu da tabela e virou título de bloco,
 * e é isso que abre largura para as demais sem precisar de paisagem.
 */
export async function exportarPdf(
  registros: Registro[],
  filtros: Filtros,
  totais: Totais
) {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;
  const marca = await carregarMarca();

  // Vale para o documento inteiro: o PDF é peça publicada, e uma coluna de
  // liquidado parcial nele circula sem a ressalva que o painel dá ao lado.
  const apurando = totais.emApuracao;

  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const margem = 36;
  const largura = doc.internal.pageSize.getWidth();
  const altura = doc.internal.pageSize.getHeight();
  const util = largura - margem * 2;

  const exercicio = filtros.ano !== null ? String(filtros.ano) : "todos";
  const geradoEm = new Date().toLocaleDateString("pt-BR");

  /*
    A marca da SEPLAN fica encostada na margem direita e ocupa 156pt dos 523pt
    úteis, então o texto da faixa dispõe de 355pt — e é ESSE o limite, não a
    largura da página. Calculado uma vez aqui porque as três linhas do cabeçalho
    precisam respeitar o mesmo teto.
  */
  const ALTURA_MARCA = 22;
  const LARGURA_MARCA = ALTURA_MARCA * PROPORCAO_MARCA;
  const FOLGA_MARCA = 12;
  const textoFaixa = largura - margem - LARGURA_MARCA - margem - FOLGA_MARCA;

  /**
   * Escreve na faixa sem deixar o texto entrar na marca.
   *
   * O corpo pedido é o desejado, não o garantido: se o texto não couber em
   * `textoFaixa`, a fonte encolhe até caber, com piso em 7pt. Existe porque o
   * título já invadiu a marca uma vez — ele media 421pt para 355pt disponíveis,
   * e nada no código reclamou. Um cabeçalho que se ajusta sozinho é preferível a
   * um que depende de alguém medir a string à mão toda vez que ela muda.
   */
  const textoNaFaixa = (
    texto: string,
    y: number,
    tamanho: number,
    negrito: boolean
  ) => {
    const t = paraPdf(texto);
    doc.setFont("helvetica", negrito ? "bold" : "normal");
    let corpo = tamanho;
    doc.setFontSize(corpo);
    while (corpo > 7 && doc.getTextWidth(t) > textoFaixa) {
      corpo -= 0.5;
      doc.setFontSize(corpo);
    }
    doc.text(t, margem, y);
  };

  /** Faixa verde no topo e rodapé institucional. Roda em toda página. */
  const moldura = () => {
    doc.setFillColor(...VERDE_ESCURO);
    doc.rect(0, 0, largura, ALTURA_FAIXA, "F");

    doc.setTextColor(255);
    /*
      O escopo do relatório ("Detalhamento por órgão e unidade") abre a linha de
      metadados em vez de completar o título. Como parte do título, a linha ia a
      421pt e passava por cima da marca; aqui ela soma 329pt e ainda sobra folga.
      O título fica com o nome do relatório, que é o que precisa do corpo 13.
    */
    textoNaFaixa("Orçamento Sensível ao Gênero", 28, 13, true);
    textoNaFaixa(
      "Departamento de Estudos e Planejamento Orçamentário - DEPPO/SEPLAN",
      43,
      8.5,
      false
    );
    textoNaFaixa(
      `Detalhamento por órgão e unidade    Exercício: ${exercicio}    Exportado em: ${geradoEm}    Página ${doc.getNumberOfPages()}`,
      58,
      8,
      false
    );

    if (marca) {
      try {
        doc.addImage(
          marca,
          "PNG",
          largura - margem - LARGURA_MARCA,
          22,
          LARGURA_MARCA,
          ALTURA_MARCA
        );
      } catch {
        // Marca ilegível para o jsPDF: segue sem ela.
      }
    }

    doc.setTextColor(150);
    doc.setFontSize(7);
    doc.text(
      paraPdf(
        "Secretaria de Estado de Planejamento - SEPLAN | Governo do Estado do Acre"
      ),
      largura / 2,
      altura - 20,
      { align: "center" }
    );
  };

  /*
    Topo livre abaixo da faixa verde.

    `startY` só vale na PRIMEIRA página de uma tabela; quando ela quebra, o
    autoTable recomeça em `margin.top`, que por omissão é 40pt — dentro da faixa,
    que tem 74. O resultado era a linha de cabeçalho da tabela impressa por cima
    da faixa e da marca da SEPLAN, a 48pt do topo. Toda tabela que possa quebrar
    precisa deste `top`.
  */
  const TOPO_UTIL = ALTURA_FAIXA + 24;

  /** Onde o próximo bloco começa, já considerando a faixa e a quebra de página. */
  const proximoY = (): number => {
    const fim = (doc as unknown as { lastAutoTable?: { finalY: number } })
      .lastAutoTable?.finalY;
    return fim ? fim + 18 : TOPO_UTIL;
  };

  const espacoParaBloco = (y: number, minimo: number): number => {
    if (y + minimo < altura - 46) return y;
    doc.addPage();
    moldura();
    return TOPO_UTIL;
  };

  moldura();

  // ---- Parâmetros do recorte ----------------------------------------------
  autoTable(doc, {
    startY: TOPO_UTIL,
    margin: { left: margem, right: margem, top: TOPO_UTIL },
    head: [[paraPdf("Parâmetros do relatório")]],
    body: descreverFiltros(filtros, registros).map((l) => [paraPdf(l)]),
    theme: "grid",
    styles: { fontSize: 8, cellPadding: 4 },
    headStyles: { fillColor: VERDE_ESCURO, textColor: 255, fontStyle: "bold" },
    bodyStyles: { fillColor: CINZA_ZEBRA, textColor: 40 },
    didDrawPage: moldura,
  });

  // ---- Um bloco por unidade orçamentária -----------------------------------
  //
  // Por unidade, e não por órgão: é a unidade que identifica a dotação no QDD, e
  // um bloco "SEJUSP" somaria a Unidade Gestora com o FUNDESEG, que são dotações
  // distintas. O cabeçalho traz o órgão e, embaixo, a unidade — antes trazia
  // `${codigo} ${sigla}` e depois o nome, com o código repetido três vezes,
  // porque as três strings vinham da mesma coluna composta da planilha.
  const dotacoes = agruparEmDotacoes(registros);
  const porUnidade = new Map<string, typeof dotacoes>();
  for (const d of dotacoes) {
    const k = `${d.orgaoCodigo}/${d.unidadeCodigo}`;
    const lista = porUnidade.get(k);
    if (lista) lista.push(d);
    else porUnidade.set(k, [d]);
  }
  const blocos = [...porUnidade.values()]
    .map((lista) => ({
      lista,
      orgao: `${lista[0].orgaoCodigo} ${lista[0].orgaoNome}`,
      unidade: lista[0].unidadeCodigo
        ? `${lista[0].unidadeCodigo} ${lista[0].unidadeNome}`
        : "Unidade orçamentária não identificada no QDD",
      curto: siglaCurta(lista[0].unidadeNome || lista[0].orgaoNome),
      aprop: lista.reduce((s, d) => s + d.apropOsg, 0),
      liq: lista.reduce((s, d) => s + d.liqOsg, 0),
    }))
    .sort((a, b) => b.aprop - a.aprop);

  for (const b of blocos) {
    let y = espacoParaBloco(proximoY(), 96);

    doc.setFillColor(...VERDE_ESCURO);
    doc.rect(margem, y, util, 26, "F");
    doc.setTextColor(255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.text(paraPdf(b.orgao), margem + 8, y + 11);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.text(paraPdf(b.unidade), margem + 8, y + 21);
    y += 26;

    autoTable(doc, {
      startY: y,
      margin: { left: margem, right: margem, top: TOPO_UTIL },
      head: [
        [
          "Aplicação Programada",
          "Proj./Ativ.",
          "Eixo",
          "Cat.",
          "Planejado OSG",
          "Liquidado OSG",
          "Exec.",
        ].map(paraPdf),
      ],
      body: b.lista.map((d) =>
        [
          emCaixaAlta(d.aplicacaoProgramada),
          d.projetoAtividade,
          d.eixos.map(nomeEixo).join(", "),
          d.categorias.join(", "),
          moeda(d.apropOsg),
          emApuracao(d.ano) ? "-" : moeda(d.liqOsg),
          emApuracao(d.ano) || !d.apropOsg
            ? "-"
            : percentual((d.liqOsg / d.apropOsg) * 100),
        ].map(paraPdf)
      ),
      styles: { fontSize: 6.8, cellPadding: 3, overflow: "linebreak" },
      headStyles: {
        fillColor: VERDE_CLARO_FAIXA,
        textColor: VERDE_ESCURO,
        fontStyle: "bold",
        fontSize: 6.8,
      },
      alternateRowStyles: { fillColor: CINZA_ZEBRA },
      // `tableWidth: util` casa a tabela com a faixa do cabeçalho do órgão e a
      // do subtotal, que também usam `util`. A primeira coluna fica sem largura
      // fixa de propósito: ela absorve a sobra, então mexer nas outras não
      // reabre a folga à direita.
      tableWidth: util,
      columnStyles: {
        1: { cellWidth: 46 },
        2: { cellWidth: 78 },
        3: { cellWidth: 24, halign: "center" },
        4: { cellWidth: 70, halign: "right" },
        5: { cellWidth: 70, halign: "right" },
        6: { cellWidth: 39, halign: "right" },
      },
      didDrawPage: moldura,
    });

    // Faixa de subtotal do órgão.
    const yTotal = proximoY() - 12;
    doc.setFillColor(...VERDE_CLARO_FAIXA);
    doc.rect(margem, yTotal, util, 18, "F");
    doc.setTextColor(...VERDE_ESCURO);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    const exec = apurando || !b.aprop ? "-" : percentual((b.liq / b.aprop) * 100);
    /*
      Os números mandam na linha; o rótulo é que cede.

      `b.curto` é a sigla da unidade, mas sete unidades do QDD não trazem sigla
      separada por hífen e caem no nome inteiro — o Fundo de Desenvolvimento de
      Recursos Humanos da SEAD passava 22pt da margem direita, escrevendo por
      cima da borda da faixa. Truncar o rótulo mantém os três valores legíveis,
      que é o que a faixa existe para mostrar; a unidade por extenso está no
      cabeçalho do bloco, logo acima.
    */
    const numeros = paraPdf(
      ` - Planejado OSG: ${moeda(b.aprop)}    Liquidado: ${
        apurando ? "-" : moeda(b.liq)
      }    Execução: ${exec}`
    );
    const rotulo = encurtarPara(
      doc,
      paraPdf(b.curto),
      util - 16 - doc.getTextWidth(numeros)
    );
    doc.text(`${rotulo}${numeros}`, margem + 8, yTotal + 12);
    doc.setFont("helvetica", "normal");
    (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY =
      yTotal + 18;
  }

  // ---- Total geral ---------------------------------------------------------
  let y = espacoParaBloco(proximoY() + 6, 92);
  doc.setFillColor(...VERDE_ESCURO);
  doc.rect(margem, y, util, 62, "F");
  doc.setTextColor(255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(paraPdf("TOTAL GERAL"), largura / 2, y + 18, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.text(
    paraPdf(
      `(${totais.orgaos} órgãos, ${totais.unidades} unidades orçamentárias)`
    ),
    largura / 2,
    y + 29,
    { align: "center" }
  );

  const colunas: [string, string][] = [
    ["Planejado OSG", moeda(totais.aprop)],
    ["Liquidado", totais.liq !== null ? moeda(totais.liq) : "em apuração"],
    ["Execução", totais.execucao !== null ? percentual(totais.execucao) : "-"],
  ];
  colunas.forEach(([rotulo, valor], i) => {
    const x = margem + util * ((i + 0.5) / 3);
    doc.setFontSize(7);
    doc.setTextColor(200);
    doc.text(paraPdf(rotulo), x, y + 43, { align: "center" });
    doc.setFontSize(10);
    doc.setTextColor(255);
    doc.setFont("helvetica", "bold");
    doc.text(paraPdf(valor), x, y + 56, { align: "center" });
    doc.setFont("helvetica", "normal");
  });
  y += 62;

  doc.setTextColor(90);
  doc.setFontSize(7.5);
  doc.text(
    paraPdf(
      `${totais.dotacoes} dotações · ${totais.entregas} entregas apropriadas`
    ),
    largura / 2,
    y + 12,
    { align: "center" }
  );
  y += 26;

  // ---- Nota metodológica ---------------------------------------------------
  y = espacoParaBloco(y, 120);
  doc.setTextColor(...VERDE_ESCURO);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(paraPdf("Nota metodológica"), margem, y + 10);
  doc.setFont("helvetica", "normal");
  y += 20;
  doc.setTextColor(70);
  doc.setFontSize(7.5);
  // A ressalva do exercício aberto entra PRIMEIRO, e não no fim da lista: ela
  // explica por que as colunas de liquidado do documento estão vazias, e quem
  // for procurar a explicação vai procurá-la antes de ler o resto.
  const partes = apurando
    ? [NOTA_EM_APURACAO, ...METODOLOGIA_PARTES]
    : METODOLOGIA_PARTES;
  for (const parte of partes) {
    const linhas = doc.splitTextToSize(
      paraPdf(`${parte.titulo}: ${parte.texto}`),
      util
    ) as string[];
    y = espacoParaBloco(y, linhas.length * 9 + 10);
    doc.text(linhas, margem, y);
    y += linhas.length * 9 + 6;
  }

  // ---- Assinatura da equipe ------------------------------------------------
  const tecnica = EQUIPE_DEPPO.tecnica
    .map((p) => `${p.nome} (${p.cargo})`)
    .join(", ");
  const coordenacao = EQUIPE_DEPPO.coordenacao
    .map((p) => `${p.nome} (${p.cargo})`)
    .join(", ");
  const credito = doc.splitTextToSize(
    paraPdf(`Coordenação: ${coordenacao} | Equipe técnica: ${tecnica}`),
    util
  ) as string[];

  y = espacoParaBloco(y + 8, credito.length * 9 + 20);
  doc.setDrawColor(200);
  doc.line(margem, y, largura - margem, y);
  doc.setTextColor(110);
  doc.setFontSize(7);
  doc.text(credito, largura / 2, y + 12, { align: "center" });

  doc.save(`osg-acre-${filtros.ano ?? "todos"}-${carimbo()}.pdf`);
}

function baixar(blob: Blob, nome: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
