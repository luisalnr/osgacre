/**
 * Carga inicial do Neon a partir de `public/data/*.json`.
 *
 *   npm run db:push     (uma vez, para criar as tabelas)
 *   npm run db:seed
 *
 * É destrutivo: apaga tudo antes de inserir. Depois da carga inicial, use a aba
 * de importação do /admin — ela grava sem derrubar os outros exercícios.
 */
import fs from "node:fs";
import path from "node:path";
import {
  leisToInserts,
  qddToInserts,
  registrosToInserts,
} from "../src/lib/db/mappers";
import * as schema from "../src/lib/db/schema";
import type { DotacaoQdd, Lei, Registro } from "../src/lib/types";
import { abrirDb } from "./conexao";

const db = abrirDb();
const LOTE = 50;

function lerJson<T>(nome: string): T[] {
  const p = path.join(process.cwd(), "public", "data", nome);
  if (!fs.existsSync(p)) {
    console.error(`Arquivo ${nome} não encontrado. Rode "npm run data:build" antes.`);
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(p, "utf8")) as T[];
}

async function inserirEmLotes<T>(
  rotulo: string,
  linhas: T[],
  inserir: (lote: T[]) => Promise<unknown>
) {
  for (let i = 0; i < linhas.length; i += LOTE) {
    await inserir(linhas.slice(i, i + LOTE));
    process.stdout.write(
      `\r  ${rotulo}: ${Math.min(i + LOTE, linhas.length)}/${linhas.length}`
    );
  }
  process.stdout.write("\n");
}

async function main() {
  const registros = lerJson<Registro>("seed-osg.json");
  const dotacoesQdd = lerJson<DotacaoQdd>("seed-qdd.json");
  const leis = lerJson<Lei>("seed-leis.json");

  console.log(
    `Carregando ${registros.length} registros, ${dotacoesQdd.length} dotações do QDD e ${leis.length} instrumentos legais.`
  );

  await db.delete(schema.registros);
  await inserirEmLotes("registros", registrosToInserts(registros), (lote) =>
    db.insert(schema.registros).values(lote)
  );

  await db.delete(schema.qdd);
  await inserirEmLotes("qdd", qddToInserts(dotacoesQdd), (lote) =>
    db.insert(schema.qdd).values(lote)
  );

  await db.delete(schema.leis);
  await inserirEmLotes("leis", leisToInserts(leis), (lote) =>
    db.insert(schema.leis).values(lote)
  );

  const anos = [...new Set(registros.map((r) => r.ano))].sort();
  for (const ano of anos) {
    const doAno = registros.filter((r) => r.ano === ano);
    const aprop = doAno.reduce((s, r) => s + r.apropOsg, 0);
    const liq = doAno.reduce((s, r) => s + r.liqOsg, 0);
    console.log(
      `  ${ano}: ${doAno.length} entregas | ${aprop.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} apropriados | ${liq.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} liquidados`
    );
  }
  console.log("Pronto.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
