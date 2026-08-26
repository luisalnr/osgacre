import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db/neon";
import { leisToInserts, rowToLei } from "@/lib/db/mappers";
import { leis } from "@/lib/db/schema";
import type { Lei } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LOTE = 50;
const sqlExcluded = (coluna: string) => sql.raw(`excluded.${coluna}`);

export async function GET() {
  try {
    const db = getDb();
    const linhas = await db.select().from(leis);
    return NextResponse.json({ leis: linhas.map(rowToLei) });
  } catch (e) {
    return NextResponse.json(
      { erro: e instanceof Error ? e.message : "Falha ao ler os instrumentos legais." },
      { status: 500 }
    );
  }
}

/**
 * O histórico de leis é sempre enviado inteiro pela planilha, então a gravação
 * limpa a tabela antes de inserir — é o único jeito de refletir remoções.
 */
export async function POST(req: Request) {
  try {
    await requireSession();
  } catch {
    return NextResponse.json({ erro: "Não autorizado." }, { status: 401 });
  }

  let corpo: { leis: Lei[] };
  try {
    corpo = (await req.json()) as { leis: Lei[] };
  } catch {
    return NextResponse.json({ erro: "Corpo inválido." }, { status: 400 });
  }

  const entrada = Array.isArray(corpo?.leis) ? corpo.leis : [];
  if (!entrada.length) {
    return NextResponse.json({ erro: "Nenhum instrumento recebido." }, { status: 400 });
  }

  try {
    const db = getDb();
    await db.delete(leis);
    const inserts = leisToInserts(entrada);
    for (let i = 0; i < inserts.length; i += LOTE) {
      await db
        .insert(leis)
        .values(inserts.slice(i, i + LOTE))
        .onConflictDoUpdate({
          target: leis.id,
          set: {
            tipo: sqlExcluded("tipo"),
            ordem: sqlExcluded("ordem"),
            numero: sqlExcluded("numero"),
            data: sqlExcluded("data"),
            doe: sqlExcluded("doe"),
            ementa: sqlExcluded("ementa"),
            orgao: sqlExcluded("orgao"),
            url: sqlExcluded("url"),
            sensivelGenero: sqlExcluded("sensivel_genero"),
            citacoes: sqlExcluded("citacoes"),
            metas: sqlExcluded("metas"),
          },
        });
    }
    return NextResponse.json({ ok: true, gravados: inserts.length });
  } catch (e) {
    return NextResponse.json(
      { erro: e instanceof Error ? e.message : "Falha ao gravar." },
      { status: 500 }
    );
  }
}
