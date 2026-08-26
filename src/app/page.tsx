import { calcularTotais, porEixo } from "@/lib/agregacoes";
import { lerLeis, lerRegistros } from "@/lib/dados";
import { BaseLegal } from "@/components/site/base-legal";
import { Cabecalho } from "@/components/site/cabecalho";
import { Eixos, type ValorEixo } from "@/components/site/eixos";
import { Hero } from "@/components/site/hero";
import { Relatorios } from "@/components/site/relatorios";
import { ChamadaPainel, Rodape } from "@/components/site/rodape";
import { Sobre } from "@/components/site/sobre";

// Os dados vêm do Neon a cada requisição; sem cache não há risco de o site
// mostrar números antigos depois de uma importação.
export const dynamic = "force-dynamic";

export default async function Pagina() {
  const [{ registros }, { leis }] = await Promise.all([lerRegistros(), lerLeis()]);

  const exercicio = registros.length
    ? Math.max(...registros.map((r) => r.ano))
    : null;
  const doExercicio = exercicio
    ? registros.filter((r) => r.ano === exercicio)
    : [];
  const totais = calcularTotais(doExercicio);

  const valoresPorEixo: Record<string, ValorEixo> = {};
  for (const fatia of porEixo(doExercicio)) {
    valoresPorEixo[fatia.chave] = {
      aprop: fatia.aprop,
      liq: fatia.liq,
      participacao: totais.aprop ? (fatia.aprop / totais.aprop) * 100 : 0,
    };
  }

  return (
    <>
      <Cabecalho />
      <main>
        <Hero
          exercicio={exercicio}
          aprop={totais.aprop}
          liq={totais.liq}
          execucao={totais.execucao}
          dotacoes={totais.dotacoes}
        />
        <Sobre />
        <Eixos exercicio={exercicio} valores={valoresPorEixo} />
        <BaseLegal leis={leis} />
        <Relatorios />
        <ChamadaPainel />
      </main>
      <Rodape />
    </>
  );
}
