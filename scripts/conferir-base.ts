/**
 * Confere o cálculo da participação do OSG na dotação contra os seeds.
 * Uso pontual: `npx tsx scripts/conferir-base.ts`
 */
import fs from "node:fs";
import path from "node:path";
import { agruparEmDotacoes, indexarQdd, pesoNaDotacao } from "../src/lib/agregacoes";
import type { DotacaoQdd, Registro } from "../src/lib/types";

const ler = <T>(n: string): T[] =>
  JSON.parse(fs.readFileSync(path.join(process.cwd(), "public", "data", n), "utf8"));

const brl = (v: number | null) =>
  v === null ? "—" : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const pct = (v: number | null) => (v === null ? "—" : v.toFixed(1) + "%");

const registros = ler<Registro>("seed-osg.json");
const qdd = indexarQdd(ler<DotacaoQdd>("seed-qdd.json"));
const dotacoes = agruparEmDotacoes(registros);

const conferir: string[] = [];
const semBase: string[] = [];
const porOrigem: Record<string, number> = {};
const cat1: number[] = [];
const cat3: number[] = [];

for (const d of dotacoes) {
  const p = pesoNaDotacao(d, qdd);
  porOrigem[p.base.origem] = (porOrigem[p.base.origem] ?? 0) + 1;
  if (p.aConferir) {
    conferir.push(
      `${d.ano}/${d.projetoAtividade} ${d.orgaoSigla} — aprop ${brl(d.apropOsg)} | A ${brl(p.base.inicial)} | B ${brl(p.base.atualizada)}`
    );
  } else if (p.percentual === null) {
    semBase.push(`${d.ano}/${d.projetoAtividade} ${d.orgaoSigla}`);
  }
  if (p.percentual !== null && d.categorias.length === 1) {
    if (d.categorias[0] === 1) cat1.push(p.percentual);
    if (d.categorias[0] === 3) cat3.push(p.percentual);
  }
}

const exato = (a: number[], alvo: number) =>
  a.filter((x) => Math.abs(x - alvo) < 0.5).length;

console.log(`dotações: ${dotacoes.length}`);
console.log(`origem da base:`, porOrigem);
console.log(`categoria 1 em 100%: ${exato(cat1, 100)}/${cat1.length}`);
console.log(`categoria 3 em 50%:  ${exato(cat3, 50)}/${cat3.length}`);
console.log(`\nsem base (${semBase.length}): ${semBase.join(" ; ") || "nenhuma"}`);
console.log(`\na conferir (${conferir.length}):`);
conferir.forEach((c) => console.log("  " + c));

console.log("\ncasos citados no plano:");
for (const [ano, proj] of [
  [2025, "12190000"],
  [2025, "80285678"],
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
      ` (base ${p.base.usouAtualizada ? "atualizada" : "inicial"}, ${p.base.origem})` +
      ` | A ${brl(p.base.inicial)} | B ${brl(p.base.atualizada)} | liq. dotação ${brl(p.base.liquidadoProjeto)}`
  );
}
