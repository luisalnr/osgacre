/**
 * Conexão com o Neon para os scripts de linha de comando.
 *
 * `src/lib/db/neon.ts` não serve aqui: ele importa `server-only`, que estoura
 * fora do runtime do Next. Daí esta cópia mínima — que mora num lugar só para
 * não virar a terceira versão da mesma função de normalizar a URL.
 *
 * Rode os scripts com `tsx --env-file=.env.local`, senão a variável não chega.
 */
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "../src/lib/db/schema";

/** Alguns drivers HTTP não aceitam channel_binding; sslmode é obrigatório no Neon. */
export function resolverUrl(): string {
  const raw =
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.DATABASE_URL_UNPOOLED ||
    "";
  if (!raw) {
    console.error("DATABASE_URL não definida. Crie o .env.local a partir do exemplo.");
    process.exit(1);
  }
  try {
    const u = new URL(raw);
    u.searchParams.delete("channel_binding");
    if (!u.searchParams.has("sslmode")) u.searchParams.set("sslmode", "require");
    return u.toString();
  } catch {
    return raw;
  }
}

export function abrirDb() {
  return drizzle(neon(resolverUrl()), { schema });
}
