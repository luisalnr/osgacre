import "server-only";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

/**
 * Cliente Drizzle + Neon (server-only), em singleton.
 * Driver HTTP serverless — é o que funciona bem nas funções do Vercel.
 */
let dbInstance: ReturnType<typeof drizzle<typeof schema>> | null = null;

/** Alguns drivers HTTP não aceitam channel_binding; sslmode é obrigatório no Neon. */
function normalizeConnectionString(url: string): string {
  try {
    const u = new URL(url);
    u.searchParams.delete("channel_binding");
    if (!u.searchParams.has("sslmode")) u.searchParams.set("sslmode", "require");
    return u.toString();
  } catch {
    return url;
  }
}

export function resolveDatabaseUrl(): string | undefined {
  const raw =
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.DATABASE_URL_UNPOOLED;
  return raw ? normalizeConnectionString(raw) : undefined;
}

export function getDb() {
  if (dbInstance) return dbInstance;
  const connectionString = resolveDatabaseUrl();
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL não definida. Configure em .env.local (local) ou nas variáveis do Vercel."
    );
  }
  dbInstance = drizzle(neon(connectionString), { schema });
  return dbInstance;
}

export const hasDatabaseUrl = (): boolean => Boolean(resolveDatabaseUrl());
