/**
 * Converte as planilhas de `_fontes/` nos seeds JSON de `public/data/`.
 *
 *   npm run data:build
 *
 * Roda offline, uma vez por carga. Depois da publicação, a verdade dos dados
 * passa a morar no Neon e a atualização acontece pela aba de importação do
 * /admin — este script serve para a carga inicial e para reprocessar as fontes.
 */
import fs from "node:fs";
import path from "node:path";
import { lerAbas } from "../src/lib/xlsx-io";
import { parseTabelaOSG } from "../src/lib/parser-osg";
import { parseOrcamentosTematicos } from "../src/lib/parser-orcamentos-tematicos";
import { parseHistoricoLeis } from "../src/lib/parser-leis";
import { parseQdd } from "../src/lib/parser-qdd";
import { checarContraQdd } from "../src/lib/checagens-qdd";
import { nomeEixo } from "../src/lib/referencias";
import type { DotacaoQdd, Registro } from "../src/lib/types";

const raiz = process.cwd();
const fontes = path.join(raiz, "_fontes");
const destino = path.join(raiz, "public", "data");

const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function construirOSG(qdd: DotacaoQdd[]): Registro[] {
  const arquivo = path.join(fontes, "OSG TOTAL.xlsx");
  const abas = lerAbas(fs.readFileSync(arquivo));
  const alvo =
    abas.find((a) => a.nome.trim().toLowerCase() === "tabela_osg") ?? abas[0];
  console.log(`\nOSG: aba "${alvo.nome}" com ${alvo.linhas.length} linhas brutas`);

  // O QDD entra aqui porque é ele que resolve e nomeia órgão e unidade.
  const r = parseTabelaOSG(alvo.linhas, qdd);
  console.log(`  registros: ${r.totalLinhas}`);
  console.log(`  exercícios: ${r.anos.join(", ")}`);

  const faltando = Object.entries(r.colunasEncontradas)
    .filter(([, ok]) => !ok)
    .map(([c]) => c);
  if (faltando.length) console.log(`  colunas ausentes: ${faltando.join(", ")}`);

  for (const a of r.avisos) {
    const onde = a.linhas.length ? ` (linhas ${a.linhas.slice(0, 8).join(", ")}${a.linhas.length > 8 ? "…" : ""})` : "";
    console.log(`  [${a.nivel}] ${a.mensagem}${onde}`);
  }

  conferir(r.registros, r.anos);

  // Conferência contra o QDD, incluindo órgão e unidade. Roda aqui porque é
  // aqui que a Tabela OSG é importada: a partir de 2026 a fonte passa a ser o
  // Relatório Orçamentos Temáticos, e a chamada acompanha.
  const check = checarContraQdd(r.registros, qdd);
  console.log(
    `
  conferidas contra o QDD: ${check.conferidas} | sem correspondência: ${check.semQdd}`
  );
  for (const a of check.avisos) console.log(`  [${a.nivel}] ${a.mensagem}`);

  return r.registros;
}

/**
 * Conferência por exercício, contra o Relatório OSG publicado.
 *
 * Serve às duas fontes: os números têm de ser comparáveis entre si, e uma
 * conferência escrita duas vezes é uma conferência que vai divergir.
 */
function conferir(registros: Registro[], anos: number[]) {
  for (const ano of anos) {
    const doAno = registros.filter((x) => x.ano === ano);
    if (!doAno.length) continue;
    const aprop = doAno.reduce((s, x) => s + x.apropOsg, 0);
    const liq = doAno.reduce((s, x) => s + x.liqOsg, 0);
    console.log(
      `  ${ano}: ${doAno.length} entregas | apropriado ${brl(aprop)} | liquidado ${brl(liq)} | execução ${((liq / aprop) * 100).toFixed(1)}%`
    );
    for (const cat of [1, 2, 3]) {
      const g = doAno.filter((x) => x.categoria === cat);
      if (!g.length) continue;
      console.log(
        `      cat ${cat}: ${brl(g.reduce((s, x) => s + x.apropOsg, 0))} / ${brl(g.reduce((s, x) => s + x.liqOsg, 0))}`
      );
    }
    const eixos = [...new Set(doAno.map((x) => x.eixo))].sort();
    for (const e of eixos) {
      const g = doAno.filter((x) => x.eixo === e);
      console.log(
        `      ${nomeEixo(e)}: ${brl(g.reduce((s, x) => s + x.apropOsg, 0))} / ${brl(g.reduce((s, x) => s + x.liqOsg, 0))}`
      );
    }
  }
}

/**
 * Relatório do Sistema de Orçamentos Temáticos — a fonte de 2026 em diante.
 *
 * Convive com a Tabela OSG em vez de substituí-la no seed: 2024 e 2025 só
 * existem na planilha antiga, e os dois conjuntos de registros vão para o mesmo
 * `seed-osg.json`. Os ids não colidem — o parser novo os prefixa com "ot" — e os
 * exercícios não se sobrepõem.
 */
function construirOrcamentosTematicos(qdd: DotacaoQdd[]): Registro[] {
  const arquivo = path.join(fontes, "OSG_SistemaOrcamentosTematicos.xlsx");
  if (!fs.existsSync(arquivo)) {
    console.log("\nOrçamentos Temáticos: arquivo não encontrado em _fontes/ — pulando.");
    return [];
  }
  const abas = lerAbas(fs.readFileSync(arquivo));
  const alvo =
    abas.find((a) => a.nome.trim().toLowerCase() === "resultados") ?? abas[0];
  console.log(
    `\nOrçamentos Temáticos: aba "${alvo.nome}" com ${alvo.linhas.length} linhas brutas`
  );

  const r = parseOrcamentosTematicos(alvo.linhas, qdd);
  console.log(`  entregas: ${r.totalLinhas} | dotações: ${r.dotacoes}`);
  console.log(`  exercícios: ${r.anos.join(", ")} | ciclo: ${r.ciclos.join(", ")}`);
  console.log(`  dotações casadas com o QDD: ${r.casadasComQdd} de ${r.dotacoes}`);

  const faltando = Object.entries(r.colunasEncontradas)
    .filter(([, ok]) => !ok)
    .map(([c]) => c);
  if (faltando.length) console.log(`  colunas ausentes: ${faltando.join(", ")}`);

  for (const a of r.avisos) {
    const onde = a.linhas.length
      ? ` (linhas ${a.linhas.slice(0, 8).join(", ")}${a.linhas.length > 8 ? "…" : ""})`
      : "";
    console.log(`  [${a.nivel}] ${a.mensagem}${onde}`);
  }

  conferir(r.registros, r.anos);
  return r.registros;
}

function construirLeis() {
  const arquivo = path.join(fontes, "HISTORICO-LEIS-OSG.xlsx");
  const abas = lerAbas(fs.readFileSync(arquivo));
  const r = parseHistoricoLeis(abas);
  console.log(`\nLeis: ${r.leis.length} instrumentos`);
  for (const [tipo, n] of Object.entries(r.porTipo)) {
    const comLink = r.leis.filter((l) => l.tipo === tipo && l.url).length;
    console.log(`  ${tipo}: ${n} (${comLink} com link para o legis.ac.gov.br)`);
  }
  if (r.abasIgnoradas.length)
    console.log(`  abas não encontradas: ${r.abasIgnoradas.join(", ")}`);

  const semNumero = r.leis.filter((l) => !l.numero).length;
  if (semNumero) console.log(`  [aviso] ${semNumero} linha(s) sem número de lei`);

  fs.writeFileSync(
    path.join(destino, "seed-leis.json"),
    JSON.stringify(r.leis, null, 2),
    "utf8"
  );
  console.log(`  -> public/data/seed-leis.json`);
}

function construirQdd(): DotacaoQdd[] {
  const arquivos = fs
    .readdirSync(fontes)
    .filter((f) => /^QDD_\d{4}\.(xls|xlsx)$/i.test(f))
    .sort();
  if (!arquivos.length) {
    console.log("\nQDD: nenhum arquivo QDD_AAAA.xls em _fontes/ — pulando.");
    return;
  }

  const todas: DotacaoQdd[] = [];
  for (const nome of arquivos) {
    const abas = lerAbas(fs.readFileSync(path.join(fontes, nome)));
    // O ano do nome do arquivo é a rede de segurança quando o cabeçalho do
    // relatório não traz "Exercício: AAAA".
    const doNome = Number(nome.match(/(\d{4})/)?.[1]);
    const r = parseQdd(abas[0].linhas, undefined);
    const ano = r.anos[0] || doNome;
    const final = r.anos[0] ? r : parseQdd(abas[0].linhas, doNome);

    console.log(
      `\nQDD ${ano}: ${final.linhasContabeis} linhas contábeis -> ${final.dotacoes.length} linhas gravadas` +
        ` (${final.dotacoesDistintas} dotações, ${final.fontes.length} fontes de recurso)`
    );
    for (const a of final.avisos) console.log(`  [aviso] ${a}`);
    const ini = final.dotacoes.reduce((s, d) => s + d.dotacaoInicial, 0);
    const atu = final.dotacoes.reduce((s, d) => s + d.dotacaoAtualizada, 0);
    const liq = final.dotacoes.reduce((s, d) => s + d.liquidado, 0);
    console.log(`  inicial ${brl(ini)} | atualizada ${brl(atu)} | liquidada ${brl(liq)}`);
    todas.push(...final.dotacoes);
  }

  fs.writeFileSync(
    path.join(destino, "seed-qdd.json"),
    JSON.stringify(todas, null, 2),
    "utf8"
  );
  console.log(`  -> public/data/seed-qdd.json (${todas.length} linhas)`);
  return todas;
}

fs.mkdirSync(destino, { recursive: true });
// O QDD vem primeiro: as duas fontes de registro só podem ser lidas depois dele,
// porque é contra o QDD que órgão e unidade orçamentária são nomeados.
const qdd = construirQdd();

// As duas fontes convivem no mesmo seed: 2024 e 2025 só existem na Tabela OSG
// manual, 2026 em diante só no relatório do sistema.
const registros = [...construirOSG(qdd), ...construirOrcamentosTematicos(qdd)];

fs.writeFileSync(
  path.join(destino, "seed-osg.json"),
  JSON.stringify(registros, null, 2),
  "utf8"
);
console.log(
  `\n-> public/data/seed-osg.json (${registros.length} entregas, ${
    new Set(registros.map((r) => r.ano)).size
  } exercícios)`
);

// Os ids das duas fontes têm de ser disjuntos — o parser novo os prefixa com
// "ot" justamente para isso. Se colidirem, uma carga sobrescreve a outra em
// silêncio, e é melhor descobrir aqui do que no banco.
const repetidos = registros.length - new Set(registros.map((r) => r.id)).size;
if (repetidos)
  console.log(`  [erro] ${repetidos} id(s) repetido(s) entre as duas fontes.`);

construirLeis();
console.log("\nPronto.");
