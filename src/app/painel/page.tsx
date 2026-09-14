import type { Metadata } from "next";
import { lerLeis, lerQdd, lerRegistros } from "@/lib/dados";
import type { DotacaoQdd } from "@/lib/types";
import { Painel } from "@/components/painel/painel";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Painel interativo",
  description:
    "Filtre por exercício, eixo, categoria e órgão executor as dotações do Orçamento Sensível ao Gênero do Estado do Acre.",
};

/**
 * O QDD tem o orçamento inteiro do estado (de 6 a 9 mil linhas por exercício), mas
 * o painel só precisa das que o OSG referencia.
 *
 * São dois filtros em série, e cada um resolve uma coisa. O `lerQdd(projetos)`
 * corta no SQL, para o Neon não mandar a tabela inteira pela rede. Este aqui
 * corta o que sobrou pelo órgão, que o SQL não tem como saber — a chave do OSG
 * é (ano, órgão, projeto) e uma mesma ação orçamentária aparece em órgãos
 * diferentes.
 */
function recortarQdd(qdd: DotacaoQdd[], chaves: Set<string>): DotacaoQdd[] {
  return qdd.filter(
    (d) =>
      chaves.has(
        `${d.ano}|${d.orgaoCodigo}/${d.unidadeCodigo}|${d.projetoAtividade}`
      ) ||
      chaves.has(`${d.ano}|${d.orgaoCodigo}|${d.projetoAtividade}`) ||
      chaves.has(`${d.ano}|*|${d.projetoAtividade}`)
  );
}

export default async function PaginaPainel() {
  // As leis alimentam a seção "Instrumentos Legais" da barra lateral.
  const [{ registros }, { leis }] = await Promise.all([lerRegistros(), lerLeis()]);

  // O QDD depende dos registros: só faz sentido buscar as ações orçamentárias
  // que o OSG cita. Custa o paralelismo de uma consulta e economiza uns 8 MB de
  // tráfego com o banco a cada visita.
  const projetos = [...new Set(registros.map((r) => r.projetoAtividade).filter(Boolean))];
  const { qdd } = await lerQdd(projetos);

  // Três chaves, uma por nível de casamento de `linhasDoQdd`: unidade, órgão e
  // projeto. O recorte precisa trazer tudo que qualquer um dos três alcança.
  const chaves = new Set<string>();
  for (const r of registros) {
    chaves.add(
      `${r.ano}|${r.orgaoCodigo}/${r.unidadeCodigo}|${r.projetoAtividade}`
    );
    chaves.add(`${r.ano}|${r.orgaoCodigo}|${r.projetoAtividade}`);
    chaves.add(`${r.ano}|*|${r.projetoAtividade}`);
  }

  return (
    <Painel registros={registros} qdd={recortarQdd(qdd, chaves)} leis={leis} />
  );
}
