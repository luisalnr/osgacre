import { agruparEmDotacoes, indexarQdd, pesoNaDotacao } from "./agregacoes";
import { moeda } from "./formato";
import type { Aviso } from "./parser-osg";
import type { DotacaoQdd, Registro } from "./types";

/**
 * Conferência da Tabela OSG contra o QDD do exercício.
 *
 * Roda na prévia da importação, depois que o arquivo é lido. Só faz sentido com
 * o QDD do mesmo exercício já carregado — é ele que traz a dotação atualizada,
 * a única capaz de explicar remanejamentos e emendas parlamentares.
 */
export function checarContraQdd(
  registros: Registro[],
  qdd: DotacaoQdd[]
): { avisos: Aviso[]; conferidas: number; semQdd: number } {
  if (!qdd.length) {
    return {
      avisos: [
        {
          nivel: "aviso",
          mensagem:
            "Não há QDD carregado para este exercício, então a conferência das dotações não rodou. Importe o QDD para que a participação do OSG seja calculada sobre a dotação real.",
          linhas: [],
        },
      ],
      conferidas: 0,
      semQdd: 0,
    };
  }

  const indice = indexarQdd(qdd);
  const dotacoes = agruparEmDotacoes(registros);

  const acimaDaDotacao: string[] = [];
  const semCorrespondencia: string[] = [];
  const divergentes: string[] = [];
  let conferidas = 0;

  for (const d of dotacoes) {
    const { base, aConferir } = pesoNaDotacao(d, indice);
    const doQdd = base.origem === "qdd-orgao" || base.origem === "qdd-projeto";

    if (!doQdd) {
      semCorrespondencia.push(`${d.ano}/${d.projetoAtividade || "sem código"} ${d.orgaoSigla}`);
      continue;
    }
    conferidas++;

    if (aConferir) {
      acimaDaDotacao.push(
        `${d.ano}/${d.projetoAtividade} ${d.orgaoSigla} — apropriado ${moeda(d.apropOsg)}, dotação inicial ${moeda(base.inicial ?? 0)}, atualizada ${moeda(base.atualizada ?? 0)}`
      );
    }

    // O rateio das colunas do projeto na planilha é inconsistente: em parte das
    // dotações o valor vem repetido em cada linha em vez de dividido, e a soma
    // sai dobrada. Quem manda no cálculo é o QDD, mas vale avisar.
    if (
      d.orcFinalProjeto > 0 &&
      base.atualizada !== null &&
      Math.abs(d.orcFinalProjeto - base.atualizada) > 1
    ) {
      divergentes.push(
        `${d.ano}/${d.projetoAtividade} ${d.orgaoSigla} — planilha ${moeda(d.orcFinalProjeto)}, QDD ${moeda(base.atualizada)}`
      );
    }
  }

  const avisos: Aviso[] = [];
  if (acimaDaDotacao.length)
    avisos.push({
      nivel: "aviso",
      mensagem: `Apropriação acima da dotação registrada no QDD em ${acimaDaDotacao.length} dotação(ões) — no painel elas aparecem como "a conferir": ${acimaDaDotacao.join(" · ")}.`,
      linhas: [],
    });
  if (semCorrespondencia.length)
    avisos.push({
      nivel: "aviso",
      mensagem: `${semCorrespondencia.length} dotação(ões) sem correspondência no QDD do exercício: ${semCorrespondencia.join(" · ")}.`,
      linhas: [],
    });
  if (divergentes.length)
    avisos.push({
      nivel: "aviso",
      mensagem: `Coluna "Orçamento Final" da planilha diferente da dotação atualizada do QDD em ${divergentes.length} dotação(ões). O painel usa o QDD; vale conferir a planilha: ${divergentes.slice(0, 12).join(" · ")}${divergentes.length > 12 ? " …" : ""}.`,
      linhas: [],
    });

  return { avisos, conferidas, semQdd: semCorrespondencia.length };
}
