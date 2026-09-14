import "server-only";
import fs from "node:fs";
import path from "node:path";
import { inArray } from "drizzle-orm";
import { unstable_cache } from "next/cache";
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
 *
 * ## Cache
 *
 * As páginas são `force-dynamic` e antes refaziam a leitura inteira a cada
 * visita: o `seed-qdd.json` tem 22.540 linhas e 15 MB, e só o `JSON.parse`
 * custava perto de 100 ms por requisição.
 *
 * A promessa que o `force-dynamic` protegia continua valendo: **importou pelo
 * /admin, o site mostra o número novo na visita seguinte.** Quem garante isso é
 * o `revalidateTag` das rotas de escrita sobre as tags exportadas aqui. Cache
 * sem essa invalidação seria regressão disfarçada de melhoria.
 *
 * São duas camadas, e cada uma existe por um motivo diferente:
 *
 * 1. **Memória de processo** para os seeds e para o QDD do Neon. É a única
 *    opção para o QDD: a fatia que o painel usa tem 2,03 MB serializados, e o
 *    Data Cache da Vercel corta em ~2 MB por entrada — `unstable_cache` ali
 *    ficaria na fronteira e falharia sem avisar.
 * 2. **`unstable_cache` com tag** para registros e instrumentos legais, que são
 *    pequenos. Diferente da memória de processo, ele sobrevive à troca de
 *    instância e é invalidado por `revalidateTag` em qualquer uma delas.
 */

/** Tags do cache. As rotas de escrita do /admin invalidam por elas. */
export const TAG_REGISTROS = "registros";
export const TAG_QDD = "qdd";
export const TAG_LEIS = "leis";

/**
 * Seeds já lidos e convertidos, guardados para o processo inteiro.
 *
 * Cache eterno é seguro aqui porque **em modo seed o dado é imutável enquanto o
 * processo vive**: a importação do /admin grava no Neon, nunca nos JSON, e quem
 * regenera esses arquivos é o `npm run data:build`, que roda offline, antes do
 * deploy. Um processo novo relê.
 */
const seedsLidos = new Map<string, unknown[]>();

function lerSeed<T>(nome: string): T[] {
  const guardado = seedsLidos.get(nome);
  if (guardado) return guardado as T[];
  try {
    const p = path.join(process.cwd(), "public", "data", nome);
    const dados = JSON.parse(fs.readFileSync(p, "utf8")) as T[];
    seedsLidos.set(nome, dados);
    return dados;
  } catch {
    // A falha não é guardada de propósito: um erro de leitura transitório
    // viraria uma lista vazia permanente até o processo reiniciar.
    return [];
  }
}

export type Origem = "neon" | "seed";

const registrosDoNeon = unstable_cache(
  async () => (await getDb().select().from(registros)).map(rowToRegistro),
  ["registros"],
  { tags: [TAG_REGISTROS] }
);

export async function lerRegistros(): Promise<{
  registros: Registro[];
  origem: Origem;
}> {
  if (hasDatabaseUrl()) {
    try {
      // Lançando aqui, nada é gravado no cache: a reserva abaixo vale só para
      // esta requisição, e não fica no lugar do Neon.
      const linhas = await registrosDoNeon();
      if (linhas.length) return { registros: linhas, origem: "neon" };
    } catch (e) {
      console.error("Falha ao ler registros do Neon; usando o seed.", e);
    }
  }
  return { registros: lerSeed<Registro>("seed-osg.json"), origem: "seed" };
}

/**
 * Versão corrente do QDD.
 *
 * Um inteiro que só muda quando `revalidateTag(TAG_QDD)` roda. Serve de chave
 * para a memória de processo: depois de uma importação, a versão muda e **toda
 * instância** erra a chave e vai buscar de novo, sem que os 2 MB do QDD
 * precisem caber no Data Cache. É o versionamento que dá invalidação entre
 * instâncias a um cache que não caberia lá.
 */
const versaoDoQdd = unstable_cache(async () => Date.now(), ["versao-qdd"], {
  tags: [TAG_QDD],
});

let versaoEmMemoria: number | null = null;
const qddEmMemoria = new Map<string, DotacaoQdd[]>();

async function qddDoNeon(projetos?: string[]): Promise<DotacaoQdd[]> {
  const versao = await versaoDoQdd();
  if (versao !== versaoEmMemoria) {
    qddEmMemoria.clear();
    versaoEmMemoria = versao;
  }

  const chave = projetos?.length ? [...projetos].sort().join(",") : "*";
  const guardado = qddEmMemoria.get(chave);
  if (guardado) return guardado;

  const base = getDb().select().from(qdd);
  const linhas = projetos?.length
    ? await base.where(inArray(qdd.projetoAtividade, projetos))
    : await base;
  const dados = linhas.map(rowToQdd);
  qddEmMemoria.set(chave, dados);
  return dados;
}

/**
 * O QDD do exercício. É a fonte da dotação inicial e da atualizada usadas para
 * calcular a participação do OSG em cada dotação (ver `baseDotacao`) e das
 * fontes de recurso que a tabela detalhada mostra.
 *
 * **Passe `projetos` sempre que souber quais interessam.** A tabela guarda o
 * orçamento inteiro do estado — de 6 a 9 mil linhas por exercício —, e o painel
 * usa as de umas 165 ações orçamentárias. Sem o filtro, cada visita a `/painel`
 * arrastaria a tabela toda do Neon para descartar 85% dela na linha seguinte.
 */
export async function lerQdd(
  projetos?: string[]
): Promise<{ qdd: DotacaoQdd[]; origem: Origem }> {
  if (hasDatabaseUrl()) {
    try {
      const linhas = await qddDoNeon(projetos);
      if (linhas.length) return { qdd: linhas, origem: "neon" };
    } catch (e) {
      console.error("Falha ao ler o QDD do Neon; usando o seed.", e);
    }
  }
  // O seed não tem WHERE, então o mesmo recorte acontece em memória. O parse
  // dos 15 MB é pago uma vez por processo; o filtro, a cada requisição.
  const doSeed = lerSeed<DotacaoQdd>("seed-qdd.json");
  const alvo = projetos?.length ? new Set(projetos) : null;
  return {
    qdd: alvo ? doSeed.filter((d) => alvo.has(d.projetoAtividade)) : doSeed,
    origem: "seed",
  };
}

const leisDoNeon = unstable_cache(
  async () => (await getDb().select().from(leis)).map(rowToLei),
  ["leis"],
  { tags: [TAG_LEIS] }
);

export async function lerLeis(): Promise<{ leis: Lei[]; origem: Origem }> {
  if (hasDatabaseUrl()) {
    try {
      const linhas = await leisDoNeon();
      if (linhas.length) return { leis: linhas, origem: "neon" };
    } catch (e) {
      console.error("Falha ao ler instrumentos legais do Neon; usando o seed.", e);
    }
  }
  return { leis: lerSeed<Lei>("seed-leis.json"), origem: "seed" };
}
