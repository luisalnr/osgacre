import {
  agruparEmDotacoes,
  indexarQdd,
  pesoNaDotacao,
  veioDoQdd,
} from "./agregacoes";
import { catalogoDeQdd, nomeSuspeito, siglaCurta } from "./orgaos";
import { moeda } from "./formato";
import type { Aviso } from "./parser-osg";
import type { Dotacao, DotacaoQdd, Registro } from "./types";

/**
 * Conferência da Tabela OSG contra o QDD do exercício.
 *
 * Roda na prévia da importação, depois que o arquivo é lido. Só faz sentido com
 * o QDD do mesmo exercício já carregado — é ele que traz a dotação atualizada,
 * a única capaz de explicar remanejamentos e emendas parlamentares.
 */
/** Como a dotação aparece nos avisos: sigla do órgão e da unidade. */
const identificar = (
  d: Pick<Dotacao, "orgaoCodigo" | "orgaoNome" | "unidadeCodigo" | "unidadeNome">
): string => {
  const orgao = siglaCurta(d.orgaoNome) || d.orgaoCodigo;
  const unidade = d.unidadeCodigo ? siglaCurta(d.unidadeNome) : "";
  return unidade && unidade !== orgao ? `${orgao}/${unidade}` : orgao;
};

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

  // --- Órgão e unidade -----------------------------------------------------
  //
  // A resolução acontece na importação (`resolver-unidade.ts`), e o parser já
  // avisa o que não fechou. O que sobra para cá é o que só dá para ver com o
  // QDD do exercício ao lado: código que a planilha usa e o QDD não conhece, e
  // nome com quebra de linha que a limpeza não cobriu.
  const catalogo = catalogoDeQdd(qdd);
  const semUnidade = new Set<string>();
  const paresDesconhecidos = new Set<string>();
  for (const r of registros) {
    if (!r.unidadeCodigo) {
      semUnidade.add(`${r.ano}/${r.projetoAtividade || "sem código"} ${identificar(r)}`);
      continue;
    }
    if (!catalogo.unidades.has(`${r.orgaoCodigo}/${r.unidadeCodigo}`))
      paresDesconhecidos.add(`${r.ano} ${r.orgaoCodigo}/${r.unidadeCodigo}`);
  }
  const nomesQuebrados = new Set<string>();
  for (const nome of [...catalogo.orgaos.values(), ...catalogo.unidades.values()])
    if (nomeSuspeito(nome)) nomesQuebrados.add(nome);

  for (const d of dotacoes) {
    const { base } = pesoNaDotacao(d, indice);
    const doQdd = veioDoQdd(base.origem);

    if (!doQdd) {
      semCorrespondencia.push(
        `${d.ano}/${d.projetoAtividade || "sem código"} ${identificar(d)}`
      );
      continue;
    }
    conferidas++;

    // Só o estado `a-conferir` vira aviso. Dotação suplementada durante o
    // exercício é rotina orçamentária e apenas ganha uma anotação no painel.
    if (base.situacao === "a-conferir") {
      acimaDaDotacao.push(
        `${d.ano}/${d.projetoAtividade} ${identificar(d)} — planejado ${moeda(d.apropOsg)}, dotação inicial ${moeda(base.inicial ?? 0)}, atualizada ${moeda(base.atualizada ?? 0)}`
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
        `${d.ano}/${d.projetoAtividade} ${identificar(d)} — planilha ${moeda(d.orcFinalProjeto)}, QDD ${moeda(base.atualizada)}`
      );
    }
  }

  const avisos: Aviso[] = [];
  if (semUnidade.size)
    avisos.push({
      nivel: "erro",
      mensagem:
        `${semUnidade.size} registro(s) sem unidade orçamentária. Cada um ` +
        "precisa de uma entrada em EXCECOES_UNIDADE (src/lib/resolver-unidade.ts): " +
        [...semUnidade].join(" · "),
      linhas: [],
    });
  if (paresDesconhecidos.size)
    avisos.push({
      nivel: "erro",
      mensagem:
        "Órgão/unidade que não existe no QDD deste exercício: " +
        [...paresDesconhecidos].join(" · ") +
        ". Ou a unidade é nova e o QDD carregado está velho, ou o código está errado na origem.",
      linhas: [],
    });
  if (nomesQuebrados.size)
    avisos.push({
      nivel: "aviso",
      mensagem:
        "Nome do QDD que parece ter quebra de linha grudada e que a limpeza não " +
        "cobriu — vale um par novo em FRAGMENTOS_QUEBRADOS (src/lib/orgaos.ts): " +
        [...nomesQuebrados].join(" · "),
      linhas: [],
    });
  if (acimaDaDotacao.length)
    avisos.push({
      nivel: "aviso",
      mensagem: `Planejado do OSG acima da dotação inicial E da atualizada em ${acimaDaDotacao.length} dotação(ões) — o painel troca o percentual por um aviso de conferência: ${acimaDaDotacao.join(" · ")}.`,
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
