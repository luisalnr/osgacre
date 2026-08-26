import { inArray, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db/neon";
import { qddToInserts, rowToQdd } from "@/lib/db/mappers";
import { qdd } from "@/lib/db/schema";
import type { DotacaoQdd } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LOTE = 50;

/**
 * `GET /api/qdd?anos=2024,2025` devolve só os exercícios pedidos — a tabela tem
 * o QDD inteiro do estado (~1.350 dotações por ano) e a prévia da importação
 * precisa apenas dos anos do arquivo em conferência.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const anos = (searchParams.get("anos") ?? "")
    .split(",")
    .map((a) => Number(a.trim()))
    .filter(Boolean);

  try {
    const db = getDb();
    const linhas = anos.length
      ? await db.select().from(qdd).where(inArray(qdd.ano, anos))
      : await db.select().from(qdd);
    return NextResponse.json({ qdd: linhas.map(rowToQdd) });
  } catch (e) {
    return NextResponse.json(
      { erro: e instanceof Error ? e.message : "Falha ao ler o QDD." },
      { status: 500 }
    );
  }
}

/**
 * O QDD é um retrato completo do exercício, então a gravação sempre substitui
 * os exercícios presentes no arquivo — não existe modo mesclar aqui. Uma dotação
 * anulada some do relatório, e mesclar a manteria viva para sempre.
 */
export async function POST(req: Request) {
  try {
    await requireSession();
  } catch {
    return NextResponse.json({ erro: "Não autorizado." }, { status: 401 });
  }

  let corpo: { qdd: DotacaoQdd[] };
  try {
    corpo = (await req.json()) as { qdd: DotacaoQdd[] };
  } catch {
    return NextResponse.json({ erro: "Corpo inválido." }, { status: 400 });
  }

  const entrada = Array.isArray(corpo?.qdd) ? corpo.qdd : [];
  if (!entrada.length) {
    return NextResponse.json({ erro: "Nenhuma dotação recebida." }, { status: 400 });
  }

  const anos = [...new Set(entrada.map((d) => d.ano))].filter(Boolean);
  if (!anos.length) {
    return NextResponse.json(
      { erro: "Não identifiquei o exercício das dotações." },
      { status: 400 }
    );
  }

  try {
    const db = getDb();
    await db.delete(qdd).where(inArray(qdd.ano, anos));

    const inserts = qddToInserts(entrada);
    for (let i = 0; i < inserts.length; i += LOTE) {
      await db
        .insert(qdd)
        .values(inserts.slice(i, i + LOTE))
        .onConflictDoUpdate({
          target: qdd.id,
          set: {
            orgaoNome: sql.raw("excluded.orgao_nome"),
            unidadeNome: sql.raw("excluded.unidade_nome"),
            aplicacaoProgramada: sql.raw("excluded.aplicacao_programada"),
            funcaoProgramatica: sql.raw("excluded.funcao_programatica"),
            dotacaoInicial: sql.raw("excluded.dotacao_inicial"),
            suplementado: sql.raw("excluded.suplementado"),
            dotacaoAtualizada: sql.raw("excluded.dotacao_atualizada"),
            empenhado: sql.raw("excluded.empenhado"),
            liquidado: sql.raw("excluded.liquidado"),
            aLiquidar: sql.raw("excluded.a_liquidar"),
            pago: sql.raw("excluded.pago"),
          },
        });
    }

    return NextResponse.json({ ok: true, gravados: inserts.length, anos });
  } catch (e) {
    return NextResponse.json(
      { erro: e instanceof Error ? e.message : "Falha ao gravar o QDD." },
      { status: 500 }
    );
  }
}
