import { inArray, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db/neon";
import { registrosToInserts, rowToRegistro } from "@/lib/db/mappers";
import { registros } from "@/lib/db/schema";
import type { Registro } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Neon HTTP tem limite de tamanho por statement; 50 linhas por vez é folgado. */
const LOTE = 50;

/** Açúcar para `excluded.<coluna>` no ON CONFLICT. */
const sqlExcluded = (coluna: string) => sql.raw(`excluded.${coluna}`);

export async function GET() {
  try {
    const db = getDb();
    const linhas = await db.select().from(registros);
    return NextResponse.json({ registros: linhas.map(rowToRegistro) });
  } catch (e) {
    return NextResponse.json(
      { erro: e instanceof Error ? e.message : "Falha ao ler os registros." },
      { status: 500 }
    );
  }
}

type Corpo = {
  registros: Registro[];
  /** `substituir` apaga só os exercícios presentes no arquivo; `mesclar` faz upsert. */
  modo: "substituir" | "mesclar";
};

export async function POST(req: Request) {
  try {
    await requireSession();
  } catch {
    return NextResponse.json({ erro: "Não autorizado." }, { status: 401 });
  }

  let corpo: Corpo;
  try {
    corpo = (await req.json()) as Corpo;
  } catch {
    return NextResponse.json({ erro: "Corpo inválido." }, { status: 400 });
  }

  const entrada = Array.isArray(corpo?.registros) ? corpo.registros : [];
  if (!entrada.length) {
    return NextResponse.json({ erro: "Nenhum registro recebido." }, { status: 400 });
  }

  const modo = corpo.modo === "substituir" ? "substituir" : "mesclar";
  const anos = [...new Set(entrada.map((r) => r.ano))].filter(Boolean);

  try {
    const db = getDb();

    // O escopo do "substituir" são os exercícios do arquivo: importar 2026 não
    // pode apagar 2024 e 2025.
    if (modo === "substituir" && anos.length) {
      await db.delete(registros).where(inArray(registros.ano, anos));
    }

    const inserts = registrosToInserts(entrada);
    for (let i = 0; i < inserts.length; i += LOTE) {
      const lote = inserts.slice(i, i + LOTE);
      await db
        .insert(registros)
        .values(lote)
        .onConflictDoUpdate({
          target: registros.id,
          set: {
            ano: sqlExcluded("ano"),
            categoria: sqlExcluded("categoria"),
            orgaoCodigo: sqlExcluded("orgao_codigo"),
            orgaoNome: sqlExcluded("orgao_nome"),
            orgaoSigla: sqlExcluded("orgao_sigla"),
            aplicacaoProgramada: sqlExcluded("aplicacao_programada"),
            projetoAtividade: sqlExcluded("projeto_atividade"),
            funcaoCodigo: sqlExcluded("funcao_codigo"),
            programaCodigo: sqlExcluded("programa_codigo"),
            eixo: sqlExcluded("eixo"),
            entrega: sqlExcluded("entrega"),
            apropOsg: sqlExcluded("aprop_osg"),
            liqOsg: sqlExcluded("liq_osg"),
            orcAprovado: sqlExcluded("orc_aprovado"),
            orcFinal: sqlExcluded("orc_final"),
            liqProjeto: sqlExcluded("liq_projeto"),
            aLiquidar: sqlExcluded("a_liquidar"),
            orcAprovadoProjeto: sqlExcluded("orc_aprovado_projeto"),
            orcFinalProjeto: sqlExcluded("orc_final_projeto"),
            liqProjetoTotal: sqlExcluded("liq_projeto_total"),
          },
        });
    }

    return NextResponse.json({ ok: true, gravados: inserts.length, anos, modo });
  } catch (e) {
    return NextResponse.json(
      { erro: e instanceof Error ? e.message : "Falha ao gravar." },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  try {
    await requireSession();
  } catch {
    return NextResponse.json({ erro: "Não autorizado." }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const ano = Number(searchParams.get("ano"));
  if (!ano) {
    return NextResponse.json(
      { erro: "Informe o exercício a excluir (?ano=2024)." },
      { status: 400 }
    );
  }

  try {
    const db = getDb();
    await db.delete(registros).where(inArray(registros.ano, [ano]));
    return NextResponse.json({ ok: true, ano });
  } catch (e) {
    return NextResponse.json(
      { erro: e instanceof Error ? e.message : "Falha ao excluir." },
      { status: 500 }
    );
  }
}
