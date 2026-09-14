/**
 * Aplica ao Neon as correções de digitação da Tabela OSG.
 *
 *   npx tsx --env-file=.env.local scripts/corrigir-classificacoes.ts
 *
 * As correções vêm de `CORRECOES_OSG` (`src/lib/parser-osg.ts`), a mesma tabela
 * que o parser usa ao gerar os seeds — para o banco e o código não divergirem.
 *
 * Três propriedades que valem de propósito:
 *
 *  - **Cirúrgico.** Um `UPDATE` de uma coluna só, com o valor errado no `WHERE`.
 *    Não encosta em valor apropriado, entrega, QDD nem leis, ao contrário do
 *    `db:seed`, que apaga tudo antes de inserir.
 *  - **Idempotente.** O valor errado está no `WHERE`, então a segunda execução
 *    não acha nada e não faz nada. Repetir é seguro.
 *  - **Possível.** O `id` dos registros é `hashId(ano, projetoAtividade,
 *    orgaoCodigo, unidadeCodigo, categoria, entrega, ordinal)` e não inclui
 *    função nem programa: corrigir esses campos não muda a identidade da linha,
 *    então dá para atualizar no lugar em vez de recarregar a base. Órgão e
 *    unidade, ao contrário, fazem parte do `id` — mudá-los exige recarga.
 */
import { and, eq, sql } from "drizzle-orm";
import { CORRECOES_OSG } from "../src/lib/parser-osg";
import { registros } from "../src/lib/db/schema";
import { abrirDb } from "./conexao";

const COLUNA = {
  programaCodigo: registros.programaCodigo,
  funcaoCodigo: registros.funcaoCodigo,
} as const;

async function main() {
  const db = abrirDb();
  let total = 0;

  for (const c of CORRECOES_OSG) {
    const coluna = COLUNA[c.campo];
    const condicoes = [eq(coluna, c.de)];
    if (c.ano !== undefined) condicoes.push(eq(registros.ano, c.ano));
    // Igualdade simples. Era `like(..., "719/219%")` enquanto `orgao_codigo`
    // guardava a string composta da planilha; agora a coluna traz só o código do
    // órgão, resolvido contra o QDD na importação.
    if (c.orgaoCodigo !== undefined)
      condicoes.push(eq(registros.orgaoCodigo, c.orgaoCodigo));
    if (c.projetoAtividade !== undefined)
      condicoes.push(eq(registros.projetoAtividade, c.projetoAtividade));

    const alvo = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(registros)
      .where(and(...condicoes));
    const n = alvo[0]?.n ?? 0;

    const escopo = [
      c.ano !== undefined ? `ano ${c.ano}` : null,
      c.orgaoCodigo !== undefined ? `órgão ${c.orgaoCodigo}` : null,
      c.projetoAtividade !== undefined ? `projeto ${c.projetoAtividade}` : null,
    ]
      .filter(Boolean)
      .join(", ");

    console.log(
      `\n${c.campo} ${c.de} -> ${c.para}${escopo ? ` (${escopo})` : " (sem escopo)"}`
    );

    if (!n) {
      console.log("  nada a corrigir — já está aplicado ou o registro não existe.");
      continue;
    }

    await db
      .update(registros)
      .set({ [c.campo]: c.para })
      .where(and(...condicoes));
    console.log(`  ${n} registro(s) atualizado(s).`);
    total += n;
  }

  console.log(
    total
      ? `\nPronto: ${total} registro(s) corrigido(s).`
      : "\nNada a fazer: o banco já está corrigido."
  );
}

main().catch((e) => {
  console.error("Falha ao corrigir:", e);
  process.exit(1);
});
