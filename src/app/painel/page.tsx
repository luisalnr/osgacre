import type { Metadata } from "next";
import { lerQdd, lerRegistros } from "@/lib/dados";
import type { DotacaoQdd } from "@/lib/types";
import { Painel } from "@/components/painel/painel";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Painel interativo",
  description:
    "Filtre por exercício, eixo, categoria e órgão executor as dotações do Orçamento Sensível ao Gênero do Estado do Acre.",
};

/**
 * O QDD tem o orçamento inteiro do estado (~1.350 dotações por exercício), mas
 * o painel só precisa das dotações que o OSG referencia — algumas centenas.
 * Filtrar aqui evita mandar o quadro completo para o navegador.
 */
function recortarQdd(qdd: DotacaoQdd[], chaves: Set<string>): DotacaoQdd[] {
  return qdd.filter(
    (d) =>
      chaves.has(`${d.ano}|${d.orgaoCodigo}|${d.projetoAtividade}`) ||
      chaves.has(`${d.ano}|*|${d.projetoAtividade}`)
  );
}

export default async function PaginaPainel() {
  const [{ registros }, { qdd }] = await Promise.all([lerRegistros(), lerQdd()]);

  // Duas chaves porque a junção tem um recuo por projeto/atividade, para as
  // ações compartilhadas entre órgãos.
  const chaves = new Set<string>();
  for (const r of registros) {
    const orgao = r.orgaoCodigo.match(/^\d+/)?.[0] ?? "";
    chaves.add(`${r.ano}|${orgao}|${r.projetoAtividade}`);
    chaves.add(`${r.ano}|*|${r.projetoAtividade}`);
  }

  return <Painel registros={registros} qdd={recortarQdd(qdd, chaves)} />;
}
