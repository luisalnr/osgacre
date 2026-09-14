import { inArray, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db/neon";
import { qddToInserts, rowToQdd } from "@/lib/db/mappers";
import { qdd } from "@/lib/db/schema";
import type { DotacaoQdd } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Lote da inserção. Com 500 linhas × 20 colunas são 10 mil parâmetros por
 * comando, folgado sob o teto do Postgres, e um exercício inteiro fecha em ~19
 * idas ao banco em vez de 186.
 */
const LOTE = 500;

/**
 * `GET /api/qdd?anos=2024,2025` devolve só os exercícios pedidos — a tabela tem
 * o QDD inteiro do estado (de 6 a 9 mil linhas por ano) e a prévia da importação
 * precisa apenas dos anos do arquivo em conferência.
 *
 * O parâmetro é obrigatório: sem ele a resposta seria a tabela inteira, dezenas
 * de MB, e nenhuma tela deste projeto quer isso.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const anos = (searchParams.get("anos") ?? "")
    .split(",")
    .map((a) => Number(a.trim()))
    .filter(Boolean);

  if (!anos.length) {
    return NextResponse.json(
      { erro: "Informe os exercícios em ?anos=2024,2025." },
      { status: 400 }
    );
  }

  try {
    const db = getDb();
    const linhas = await db.select().from(qdd).where(inArray(qdd.ano, anos));
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
 *
 * A gravação vem **fatiada**: um exercício chega a 9.300 linhas, que em JSON passam
 * de 4 MB e esbarram no teto de corpo de requisição da hospedagem. O cliente
 * manda em pedaços e marca `substituir: true` só no primeiro, que é quem apaga
 * os exercícios antigos — se todos apagassem, cada fatia limparia a anterior e
 * sobraria só a última.
 */
export async function POST(req: Request) {
  try {
    await requireSession();
  } catch {
    return NextResponse.json({ erro: "Não autorizado." }, { status: 401 });
  }

  let corpo: { qdd: DotacaoQdd[]; substituir?: boolean };
  try {
    corpo = (await req.json()) as { qdd: DotacaoQdd[]; substituir?: boolean };
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
    // Sem `substituir` explícito o comportamento é o de sempre: uma requisição
    // só, que apaga e regrava.
    if (corpo.substituir !== false) {
      await db.delete(qdd).where(inArray(qdd.ano, anos));
    }

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
            fonte: sql.raw("excluded.fonte"),
            contaDespesa: sql.raw("excluded.conta_despesa"),
            descricaoDespesa: sql.raw("excluded.descricao_despesa"),
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
