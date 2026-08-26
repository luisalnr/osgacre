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
import { parseHistoricoLeis } from "../src/lib/parser-leis";
import { parseQdd } from "../src/lib/parser-qdd";
import { nomeEixo } from "../src/lib/referencias";
import type { DotacaoQdd } from "../src/lib/types";

const raiz = process.cwd();
const fontes = path.join(raiz, "_fontes");
const destino = path.join(raiz, "public", "data");

const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function construirOSG() {
  const arquivo = path.join(fontes, "OSG TOTAL.xlsx");
  const abas = lerAbas(fs.readFileSync(arquivo));
  const alvo =
    abas.find((a) => a.nome.trim().toLowerCase() === "tabela_osg") ?? abas[0];
  console.log(`\nOSG: aba "${alvo.nome}" com ${alvo.linhas.length} linhas brutas`);

  const r = parseTabelaOSG(alvo.linhas);
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

  // Conferência contra o Relatório OSG publicado.
  for (const ano of r.anos) {
    const doAno = r.registros.filter((x) => x.ano === ano);
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

  fs.writeFileSync(
    path.join(destino, "seed-osg.json"),
    JSON.stringify(r.registros, null, 2),
    "utf8"
  );
  console.log(`  -> public/data/seed-osg.json`);
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

function construirQdd() {
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

    console.log(`\nQDD ${ano}: ${final.linhasContabeis} linhas contábeis -> ${final.dotacoes.length} dotações`);
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
  console.log(`  -> public/data/seed-qdd.json (${todas.length} dotações)`);
}

fs.mkdirSync(destino, { recursive: true });
construirOSG();
construirQdd();
construirLeis();
console.log("\nPronto.");
