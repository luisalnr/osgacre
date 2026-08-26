import {
  agruparEmDotacoes,
  pesoNaDotacao,
  type IndiceQdd,
} from "./agregacoes";
import { moeda, percentual } from "./formato";
import { nomeEixo, nomeFuncao, nomePrograma } from "./referencias";
import type { Filtros, Registro, Totais } from "./types";

/**
 * Exportações do painel. As duas respeitam o recorte na tela: o que sai é
 * exatamente o que está filtrado, e o cabeçalho registra quais filtros estavam
 * ativos — sem isso um arquivo solto vira um número sem procedência.
 *
 * `exceljs` e `jspdf` são pesados, então entram por import dinâmico: só são
 * baixados quando alguém realmente clica em exportar.
 */

const MOEDA_XLSX = '"R$" #,##0.00';

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

function descreverFiltros(f: Filtros, opcoesEixos: Map<string, string>): string[] {
  const linhas: string[] = [];
  linhas.push(`Exercício: ${f.ano ?? "todos"}`);
  linhas.push(
    `Eixos: ${f.eixos.length ? f.eixos.map((e) => opcoesEixos.get(e) ?? nomeEixo(e)).join(", ") : "todos"}`
  );
  linhas.push(
    `Categorias: ${f.categorias.length ? f.categorias.join(", ") : "todas"}`
  );
  linhas.push(`Órgãos: ${f.orgaos.length ? f.orgaos.join(", ") : "todos"}`);
  if (f.busca.trim()) linhas.push(`Busca: "${f.busca.trim()}"`);
  return linhas;
}

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

  const abaDotacoes = wb.addWorksheet("Dotações");
  abaDotacoes.columns = [
    { header: "Exercício", key: "ano", width: 11 },
    { header: "Órgão", key: "orgao", width: 18 },
    { header: "Unidade orçamentária", key: "unidade", width: 46 },
    { header: "Aplicação programada", key: "aplicacao", width: 60 },
    { header: "Projeto/Atividade", key: "projeto", width: 18 },
    { header: "Função orçamentária", key: "funcao", width: 28 },
    { header: "Programa", key: "programa", width: 34 },
    { header: "Eixo", key: "eixo", width: 32 },
    { header: "Categoria", key: "categoria", width: 11 },
    { header: "Apropriação OSG", key: "aprop", width: 18, style: { numFmt: MOEDA_XLSX } },
    { header: "Liquidado OSG", key: "liq", width: 18, style: { numFmt: MOEDA_XLSX } },
    { header: "Execução (%)", key: "execucao", width: 14, style: { numFmt: "0.0%" } },
    { header: "Participação do OSG na dotação (%)", key: "peso", width: 30, style: { numFmt: "0.0%" } },
    { header: "Base do percentual", key: "baseRotulo", width: 22 },
    { header: "Dotação inicial", key: "dotInicial", width: 18, style: { numFmt: MOEDA_XLSX } },
    { header: "Dotação atualizada", key: "dotAtualizada", width: 20, style: { numFmt: MOEDA_XLSX } },
    { header: "Liquidado da dotação", key: "dotLiquidado", width: 20, style: { numFmt: MOEDA_XLSX } },
    { header: "Fonte da dotação", key: "dotFonte", width: 18 },
  ];

  for (const d of dotacoes) {
    const peso = pesoNaDotacao(d, qdd);
    const { base } = peso;
    abaDotacoes.addRow({
      ano: d.ano,
      orgao: d.orgaoSigla,
      unidade: d.orgaoNome,
      aplicacao: d.aplicacaoProgramada,
      projeto: d.projetoAtividade,
      funcao: nomeFuncao(d.funcaoCodigo),
      programa: nomePrograma(d.programaCodigo),
      eixo: nomeEixo(d.eixo),
      categoria: d.categorias.join(", "),
      aprop: d.apropOsg,
      liq: d.liqOsg,
      execucao: d.apropOsg ? d.liqOsg / d.apropOsg : null,
      peso: peso.percentual === null ? null : peso.percentual / 100,
      baseRotulo: peso.aConferir
        ? "a conferir"
        : peso.percentual === null
          ? "não informada"
          : base.usouAtualizada
            ? "dotação atualizada"
            : "dotação inicial",
      dotInicial: base.inicial,
      dotAtualizada: base.atualizada,
      dotLiquidado: base.liquidadoProjeto,
      dotFonte:
        base.origem === "qdd-orgao" || base.origem === "qdd-projeto"
          ? "QDD"
          : base.origem === "planilha"
            ? "planilha do OSG"
            : "",
    });
  }

  const abaEntregas = wb.addWorksheet("Entregas");
  abaEntregas.columns = [
    { header: "Exercício", key: "ano", width: 11 },
    { header: "Órgão", key: "orgao", width: 18 },
    { header: "Aplicação programada", key: "aplicacao", width: 60 },
    { header: "Projeto/Atividade", key: "projeto", width: 18 },
    { header: "Eixo", key: "eixo", width: 32 },
    { header: "Categoria", key: "categoria", width: 11 },
    { header: "Entrega apropriada", key: "entrega", width: 80 },
    { header: "Apropriação OSG", key: "aprop", width: 18, style: { numFmt: MOEDA_XLSX } },
    { header: "Liquidado OSG", key: "liq", width: 18, style: { numFmt: MOEDA_XLSX } },
  ];

  for (const r of registros) {
    abaEntregas.addRow({
      ano: r.ano,
      orgao: r.orgaoSigla,
      aplicacao: r.aplicacaoProgramada,
      projeto: r.projetoAtividade,
      eixo: nomeEixo(r.eixo),
      categoria: r.categoria,
      entrega: r.entrega,
      aprop: r.apropOsg,
      liq: r.liqOsg,
    });
  }

  const abaResumo = wb.addWorksheet("Recorte");
  abaResumo.columns = [
    { header: "Item", key: "item", width: 42 },
    { header: "Valor", key: "valor", width: 60 },
  ];
  const mapaEixos = new Map<string, string>();
  abaResumo.addRow({ item: "Fonte", valor: "DEPPO/SEPLAN — Orçamento Sensível ao Gênero" });
  abaResumo.addRow({ item: "Gerado em", valor: new Date().toLocaleString("pt-BR") });
  for (const linha of descreverFiltros(filtros, mapaEixos)) {
    const [item, ...resto] = linha.split(": ");
    abaResumo.addRow({ item, valor: resto.join(": ") });
  }
  abaResumo.addRow({ item: "Apropriação OSG", valor: moeda(totais.aprop) });
  abaResumo.addRow({ item: "Liquidado OSG", valor: moeda(totais.liq) });
  abaResumo.addRow({
    item: "Execução",
    valor: totais.execucao !== null ? percentual(totais.execucao) : "—",
  });
  abaResumo.addRow({ item: "Dotações", valor: String(totais.dotacoes) });
  abaResumo.addRow({ item: "Entregas apropriadas", valor: String(totais.entregas) });

  for (const aba of [abaDotacoes, abaEntregas, abaResumo]) {
    aba.getRow(1).font = { bold: true };
    aba.getRow(1).alignment = { vertical: "middle" };
    aba.views = [{ state: "frozen", ySplit: 1 }];
  }

  const buffer = await wb.xlsx.writeBuffer();
  baixar(
    new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    `osg-acre-${filtros.ano ?? "todos"}-${carimbo()}.xlsx`
  );
}

export async function exportarPdf(
  registros: Registro[],
  filtros: Filtros,
  totais: Totais
) {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;

  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const margem = 36;

  doc.setFontSize(16);
  doc.text(paraPdf("Orçamento Sensível ao Gênero — Estado do Acre"), margem, 44);
  doc.setFontSize(9);
  doc.setTextColor(110);
  doc.text(
    paraPdf(`Fonte: DEPPO/SEPLAN · Gerado em ${new Date().toLocaleString("pt-BR")}`),
    margem,
    60
  );

  const resumo = [
    ...descreverFiltros(filtros, new Map()),
    `Apropriação OSG: ${moeda(totais.aprop)}`,
    `Liquidado OSG: ${moeda(totais.liq)}`,
    `Execução: ${totais.execucao !== null ? percentual(totais.execucao) : "-"}`,
    `Dotações: ${totais.dotacoes} · Entregas: ${totais.entregas} · Órgãos: ${totais.orgaos}`,
  ];
  doc.setTextColor(40);
  let y = 78;
  for (const linha of resumo) {
    doc.text(paraPdf(linha), margem, y);
    y += 12;
  }

  // O PDF fica só com as duas colunas do OSG e a execução. Os valores da
  // dotação vinda do QDD entram no XLSX, onde há espaço para eles.
  const dotacoes = agruparEmDotacoes(registros);
  autoTable(doc, {
    startY: y + 8,
    margin: { left: margem, right: margem },
    head: [
      [
        "Órgão",
        "Aplicação programada",
        "Proj./Atividade",
        "Eixo",
        "Cat.",
        "Apropriado",
        "Liquidado",
        "Exec.",
      ],
    ],
    body: dotacoes.map((d) =>
      [
        d.orgaoSigla,
        d.aplicacaoProgramada,
        d.projetoAtividade,
        nomeEixo(d.eixo),
        d.categorias.join(", "),
        moeda(d.apropOsg),
        moeda(d.liqOsg),
        d.apropOsg ? percentual((d.liqOsg / d.apropOsg) * 100) : "-",
      ].map(paraPdf)
    ),
    styles: { fontSize: 7.5, cellPadding: 3, overflow: "linebreak" },
    headStyles: { fillColor: [18, 63, 48], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [246, 247, 243] },
    columnStyles: {
      0: { cellWidth: 70 },
      1: { cellWidth: 240 },
      2: { cellWidth: 62 },
      3: { cellWidth: 110 },
      4: { cellWidth: 28, halign: "center" },
      5: { cellWidth: 74, halign: "right" },
      6: { cellWidth: 74, halign: "right" },
      7: { cellWidth: 42, halign: "right" },
    },
    didDrawPage: (dados) => {
      const pagina = doc.getNumberOfPages();
      doc.setFontSize(8);
      doc.setTextColor(140);
      doc.text(
        paraPdf(`Página ${pagina}`),
        doc.internal.pageSize.getWidth() - margem,
        doc.internal.pageSize.getHeight() - 18,
        { align: "right" }
      );
      doc.text(
        paraPdf(
          "Valores referentes à parcela apropriada ao OSG, não à dotação inteira."
        ),
        dados.settings.margin.left,
        doc.internal.pageSize.getHeight() - 18
      );
    },
  });

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
