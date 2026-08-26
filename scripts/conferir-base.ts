/**
 * Confere o cálculo da participação do OSG na dotação contra os seeds.
 * Uso pontual: `npx tsx scripts/conferir-base.ts`
 */
import fs from "node:fs";
import path from "node:path";
import {
  agruparEmDotacoes,
  indexarQdd,
  pesoNaDotacao,
  type SituacaoDotacao,
} from "../src/lib/agregacoes";
import type { DotacaoQdd, Registro } from "../src/lib/types";

const ler = <T>(n: string): T[] =>
  JSON.parse(fs.readFileSync(path.join(process.cwd(), "public", "data", n), "utf8"));

const brl = (v: number | null) =>
  v === null ? "—" : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const pct = (v: number | null) => (v === null ? "—" : v.toFixed(1) + "%");

const registros = ler<Registro>("seed-osg.json");
const qdd = indexarQdd(ler<DotacaoQdd>("seed-qdd.json"));
const dotacoes = agruparEmDotacoes(registros);

const porSituacao: Record<SituacaoDotacao, string[]> = {
  normal: [],
  suplementada: [],
  "a-conferir": [],
  indisponivel: [],
};
const porOrigem: Record<string, number> = {};
const cat1: number[] = [];
const cat3: number[] = [];
let emendas = 0;

for (const d of dotacoes) {
  const p = pesoNaDotacao(d, qdd);
  porOrigem[p.base.origem] = (porOrigem[p.base.origem] ?? 0) + 1;
  if (p.base.ehEmenda) emendas++;
  porSituacao[p.base.situacao].push(
    `${d.ano}/${d.projetoAtividade || "sem código"} ${d.orgaoSigla} cat${d.categorias.join(",")}` +
      ` — planejado ${brl(d.apropOsg)} | inicial ${brl(p.base.inicial)} | atualizada ${brl(p.base.atualizada)}`
  );
  if (p.percentual !== null && d.categorias.length === 1) {
    if (d.categorias[0] === 1) cat1.push(p.percentual);
    if (d.categorias[0] === 3) cat3.push(p.percentual);
  }
}

const exato = (a: number[], alvo: number) =>
  a.filter((x) => Math.abs(x - alvo) < 0.5).length;

console.log(`dotações: ${dotacoes.length} (${emendas} emendas parlamentares)`);
console.log("origem da base:", porOrigem);
console.log(
  "situação:",
  Object.fromEntries(Object.entries(porSituacao).map(([k, v]) => [k, v.length]))
);
console.log(`categoria 1 em 100%: ${exato(cat1, 100)}/${cat1.length}`);
console.log(`categoria 3 em 50%:  ${exato(cat3, 50)}/${cat3.length}`);

for (const estado of ["suplementada", "a-conferir", "indisponivel"] as const) {
  console.log(`\n${estado} (${porSituacao[estado].length}):`);
  porSituacao[estado].forEach((x) => console.log("  " + x));
}

console.log("\ncasos de referência:");
for (const [ano, proj] of [
  [2025, "12190000"],
  [2025, "80285678"],
  [2024, "80285073"],
  [2025, "21870000"],
  [2024, "10180000"],
] as const) {
  const d = dotacoes.find((x) => x.ano === ano && x.projetoAtividade === proj);
  if (!d) {
    console.log(`  ${ano}/${proj}: não encontrada`);
    continue;
  }
  const p = pesoNaDotacao(d, qdd);
  console.log(
    `  ${ano}/${proj} ${d.orgaoSigla} cat ${d.categorias.join(",")} -> ${pct(p.percentual)}` +
      ` [${p.base.situacao}${p.base.ehEmenda ? ", emenda" : ""}, ${p.base.origem}]` +
      ` | inicial ${brl(p.base.inicial)} | atualizada ${brl(p.base.atualizada)}`
  );
}
