import "server-only";
import fs from "node:fs";
import path from "node:path";
import { rowToLei, rowToQdd, rowToRegistro } from "./db/mappers";
import { getDb, hasDatabaseUrl } from "./db/neon";
import { leis, qdd, registros } from "./db/schema";
import type { DotacaoQdd, Lei, Registro } from "./types";

/**
 * Leitura dos dados para os server components.
 *
 * A verdade mora no Neon. Os JSON de `public/data/` são a carga inicial e valem
 * como reserva: sem DATABASE_URL configurada — ou se o banco falhar — o site
 * continua de pé mostrando a última carga conhecida, em vez de quebrar. Quem
 * atualiza os dados de verdade é a aba de importação do /admin.
 */

function lerSeed<T>(nome: string): T[] {
  try {
    const p = path.join(process.cwd(), "public", "data", nome);
    return JSON.parse(fs.readFileSync(p, "utf8")) as T[];
  } catch {
    return [];
  }
}

export type Origem = "neon" | "seed";

export async function lerRegistros(): Promise<{
  registros: Registro[];
  origem: Origem;
}> {
  if (hasDatabaseUrl()) {
    try {
      const linhas = await getDb().select().from(registros);
      if (linhas.length) {
        return { registros: linhas.map(rowToRegistro), origem: "neon" };
      }
    } catch (e) {
      console.error("Falha ao ler registros do Neon; usando o seed.", e);
    }
  }
  return { registros: lerSeed<Registro>("seed-osg.json"), origem: "seed" };
}

/**
 * O QDD do exercício. É a fonte da dotação inicial e da atualizada usadas para
 * calcular a participação do OSG em cada dotação — ver `baseDotacao`.
 */
export async function lerQdd(): Promise<{ qdd: DotacaoQdd[]; origem: Origem }> {
  if (hasDatabaseUrl()) {
    try {
      const linhas = await getDb().select().from(qdd);
      if (linhas.length) {
        return { qdd: linhas.map(rowToQdd), origem: "neon" };
      }
    } catch (e) {
      console.error("Falha ao ler o QDD do Neon; usando o seed.", e);
    }
  }
  return { qdd: lerSeed<DotacaoQdd>("seed-qdd.json"), origem: "seed" };
}

export async function lerLeis(): Promise<{ leis: Lei[]; origem: Origem }> {
  if (hasDatabaseUrl()) {
    try {
      const linhas = await getDb().select().from(leis);
      if (linhas.length) {
        return { leis: linhas.map(rowToLei), origem: "neon" };
      }
    } catch (e) {
      console.error("Falha ao ler instrumentos legais do Neon; usando o seed.", e);
    }
  }
  return { leis: lerSeed<Lei>("seed-leis.json"), origem: "seed" };
}
