import { chaveUnidade } from "./orgaos";
import type { DotacaoQdd } from "./types";

/**
 * Descobre a que órgão e unidade orçamentária do QDD pertence uma linha da
 * Tabela OSG.
 *
 * A Tabela OSG traz órgão e unidade fundidos numa string preenchida à mão
 * (`"721/302 - FUNDHACRE"`, `"754 - SEOP"`), e o que ela chama de órgão é, em
 * parte das linhas, o **executor** da entrega, não a unidade onde a dotação
 * está. O QDD é que sabe: é dele que sai a classificação orçamentária oficial.
 *
 * Não existe regra simples. Conferido nas 185 linhas de 2024 e 2025:
 *
 *  - "sem barra quer dizer unidade 001" é **falso** — das 153 linhas sem barra,
 *    26 pertencem a outra unidade, entre elas as 12 da SESACRE, todas no
 *    `721/607 FUNDO ESTADUAL DE SAÚDE`, e 7 da SEASDH, no `760/608 FEAS`;
 *  - o código depois da barra às vezes não existe — `719/219` para o IAPEN, que
 *    no QDD é `719/209` em todos os exercícios;
 *  - em 2024, 13 linhas de PMAC, CBMAC e PCAC têm projetos que no QDD só
 *    existem na SEJUSP, com a dotação no `719/637 FUNDESEG`.
 *
 * O que resolve quase tudo é o **projeto/atividade**: ele identifica a ação
 * orçamentária, e na maioria das vezes existe numa unidade só. O resto está em
 * `EXCECOES_UNIDADE`.
 */
export type OrigemUnidade =
  | "excecao"
  | "exata"
  | "unica"
  | "outro-orgao"
  | "codigo-osg"
  | "";

export type ResolucaoUnidade = {
  orgaoCodigo: string;
  unidadeCodigo: string;
  origem: OrigemUnidade;
  /** Pares `"719/001"` possíveis, quando a resolução não foi conclusiva. */
  candidatos: string[];
};

export type IndiceOrgaoUnidade = {
  /** `"2025|11530000"` → `["719/209", "719/626"]` */
  porProjeto: Map<string, string[]>;
  /** `"2025|721/302"` — pares que existem no QDD daquele exercício. */
  pares: Set<string>;
};

export function indexarOrgaoUnidade(
  dotacoes: DotacaoQdd[]
): IndiceOrgaoUnidade {
  const porProjeto = new Map<string, string[]>();
  const pares = new Set<string>();
  for (const d of dotacoes) {
    if (!d.orgaoCodigo) continue;
    const par = chaveUnidade(d.orgaoCodigo, d.unidadeCodigo);
    pares.add(`${d.ano}|${par}`);
    if (!d.projetoAtividade) continue;
    const k = `${d.ano}|${d.projetoAtividade}`;
    const lista = porProjeto.get(k);
    if (!lista) porProjeto.set(k, [par]);
    else if (!lista.includes(par)) lista.push(par);
  }
  return { porProjeto, pares };
}

/**
 * Resolução manual das linhas que o projeto/atividade não desempata sozinho.
 *
 * São os casos em que a ação orçamentária existe em duas unidades do mesmo
 * órgão — quase sempre a Unidade Gestora e um fundo. Cada entrada foi decidida
 * conferindo os valores da própria Tabela OSG contra o QDD, e o `motivo` diz
 * qual evidência mandou.
 *
 * A conferência precisa somar por (ano, projeto/atividade) antes de comparar: as
 * colunas de projeto da planilha chegam **rateadas** pelo número de linhas do
 * grupo, como explica o comentário de `osg_registros` em `db/schema.ts`. Somadas,
 * `Orçamento Aprovado` bate com a dotação inicial e `Orçamento Final` com a
 * atualizada — dois sinais independentes, que concordam em todos os casos abaixo.
 *
 * A chave inclui o código como a planilha o escreve. É o mesmo princípio de
 * reserva de `CORRECOES_OSG` em `parser-osg.ts`: no dia em que a Tabela OSG for
 * corrigida na origem e passar a trazer `719/637`, a chave deixa de casar e a
 * entrada fica inerte sozinha, sem poder passar por cima de um dado já certo.
 */
export type ExcecaoUnidade = {
  ano: number;
  /** Código como a Tabela OSG o traz: `"608"`, `"719/219"`. */
  orgaoOsg: string;
  projetoAtividade: string;
  /** Par canônico do QDD: `"719/637"`. */
  para: string;
  motivo: string;
};

const FUNDESEG =
  "Ação da segurança pública custeada pelo FUNDESEG. Somado o grupo do " +
  "projeto, o Orçamento Aprovado do OSG bate exatamente com a dotação inicial " +
  "do fundo e o Orçamento Final com a atualizada; a Unidade Gestora não bate " +
  "com nenhum dos dois.";

const FUNDESEG_EXECUTOR =
  FUNDESEG +
  " A Tabela OSG registrou aqui o órgão que executou a entrega, não a unidade " +
  "onde a dotação está: o projeto não existe no QDD sob este órgão.";

export const EXCECOES_UNIDADE: ExcecaoUnidade[] = [
  // 2024 — SEJUSP e as forças que executam ações custeadas pelo FUNDESEG.
  { ano: 2024, orgaoOsg: "719", projetoAtividade: "11120000", para: "719/637", motivo: FUNDESEG },
  { ano: 2024, orgaoOsg: "719", projetoAtividade: "21570000", para: "719/637", motivo: FUNDESEG },
  {
    ano: 2024,
    orgaoOsg: "719",
    projetoAtividade: "21800000",
    para: "719/637",
    motivo: FUNDESEG + " A Unidade Gestora está zerada neste projeto.",
  },
  { ano: 2024, orgaoOsg: "608", projetoAtividade: "11110000", para: "719/637", motivo: FUNDESEG_EXECUTOR },
  { ano: 2024, orgaoOsg: "608", projetoAtividade: "21570000", para: "719/637", motivo: FUNDESEG_EXECUTOR },
  { ano: 2024, orgaoOsg: "608", projetoAtividade: "11150000", para: "719/637", motivo: FUNDESEG_EXECUTOR },
  { ano: 2024, orgaoOsg: "609", projetoAtividade: "21570000", para: "719/637", motivo: FUNDESEG_EXECUTOR },
  { ano: 2024, orgaoOsg: "609", projetoAtividade: "11110000", para: "719/637", motivo: FUNDESEG_EXECUTOR },
  { ano: 2024, orgaoOsg: "451", projetoAtividade: "11110000", para: "719/637", motivo: FUNDESEG_EXECUTOR },
  { ano: 2024, orgaoOsg: "451", projetoAtividade: "11140000", para: "719/637", motivo: FUNDESEG_EXECUTOR },
  { ano: 2024, orgaoOsg: "451", projetoAtividade: "11120000", para: "719/637", motivo: FUNDESEG_EXECUTOR },
  {
    ano: 2024,
    orgaoOsg: "720",
    projetoAtividade: "11240000",
    para: "720/001",
    motivo:
      "O valor do OSG cobre as duas unidades (405.200,00 = 403.200,00 da " +
      "Unidade Gestora + 2.000,00 do Fundo Estadual de Meio Ambiente). Fica na " +
      "720/001, que responde por 99,5% da dotação.",
  },

  // 2025
  { ano: 2025, orgaoOsg: "719", projetoAtividade: "11120000", para: "719/637", motivo: FUNDESEG },
  { ano: 2025, orgaoOsg: "719", projetoAtividade: "21570000", para: "719/637", motivo: FUNDESEG },
  {
    ano: 2025,
    orgaoOsg: "608",
    projetoAtividade: "20760000",
    para: "608/001",
    motivo:
      "Aprovado e Final batem com a Unidade Gestora; o FUNESPOM (608/644) está " +
      "zerado neste projeto.",
  },
  {
    ano: 2025,
    orgaoOsg: "451",
    projetoAtividade: "11050000",
    para: "451/001",
    motivo:
      "O valor do OSG cobre as duas unidades; a Unidade Gestora responde por " +
      "938.332,14 dos 1.338.332,14.",
  },
  {
    ano: 2025,
    orgaoOsg: "451",
    projetoAtividade: "11100000",
    para: "451/001",
    motivo:
      "O valor do OSG cobre as duas unidades; a Unidade Gestora responde por " +
      "6.850.815,04 dos 7.454.572,04.",
  },
  {
    ano: 2025,
    orgaoOsg: "451",
    projetoAtividade: "11090000",
    para: "451/001",
    motivo:
      "O valor do OSG cobre as duas unidades; a Unidade Gestora responde por " +
      "994.619,71 dos 1.194.619,71.",
  },
  {
    ano: 2025,
    orgaoOsg: "719/219",
    projetoAtividade: "11530000",
    para: "719/626",
    motivo:
      "O código 719/219 não existe no QDD — o IAPEN é 719/209. Neste projeto o " +
      "valor do OSG cobre as duas unidades, e o Fundo Penitenciário (719/626) " +
      "responde por 960.000,00 dos 960.886,99.",
  },
  {
    ano: 2025,
    orgaoOsg: "720",
    projetoAtividade: "11240000",
    para: "720/001",
    motivo:
      "Aprovado e Final batem com a Unidade Gestora; o Fundo Estadual de Meio " +
      "Ambiente (720/622) tem 1.000,00, fora do valor do OSG.",
  },
];

const separarPar = (par: string) => {
  const [orgao = "", unidade = ""] = par.split("/");
  return { orgaoCodigo: orgao, unidadeCodigo: unidade };
};

/**
 * Órgão e unidade canônicos de uma linha da Tabela OSG.
 *
 * A ordem das tentativas vai da evidência mais forte para a mais fraca, e a
 * `origem` devolvida diz qual delas valeu — é ela que o relatório de
 * divergências usa para separar o que foi resolvido com segurança do que merece
 * conferência.
 */
export function resolverUnidade(
  entrada: { ano: number; codigoOsg: string; projetoAtividade: string },
  idx: IndiceOrgaoUnidade
): ResolucaoUnidade {
  const { ano, codigoOsg, projetoAtividade } = entrada;
  const orgaoOsg = codigoOsg.split("/")[0] ?? "";

  // 1. Resolução manual, decidida caso a caso contra os valores do QDD.
  const exc = EXCECOES_UNIDADE.find(
    (e) =>
      e.ano === ano &&
      e.orgaoOsg === codigoOsg &&
      e.projetoAtividade === projetoAtividade
  );
  if (exc) return { ...separarPar(exc.para), origem: "excecao", candidatos: [] };

  const candidatos = idx.porProjeto.get(`${ano}|${projetoAtividade}`) ?? [];

  // 2. O par escrito na planilha existe no QDD e tem mesmo este projeto.
  if (codigoOsg.includes("/") && candidatos.includes(codigoOsg))
    return { ...separarPar(codigoOsg), origem: "exata", candidatos: [] };

  // 3. O projeto existe numa unidade só deste órgão. Cobre 149 das 185 linhas,
  //    inclusive as 26 que não são a 001 e a correção de 719/219 para 719/209.
  const doOrgao = candidatos.filter((c) => c.split("/")[0] === orgaoOsg);
  if (doOrgao.length === 1)
    return { ...separarPar(doOrgao[0]), origem: "unica", candidatos: [] };

  // 4. O projeto existe numa unidade só, em outro órgão: a planilha registrou o
  //    executor da entrega, e a dotação está em outro lugar.
  if (!doOrgao.length && candidatos.length === 1)
    return {
      ...separarPar(candidatos[0]),
      origem: "outro-orgao",
      candidatos: [],
    };

  // 5. Sem projeto para conferir, mas o par da planilha existe no QDD. É o caso
  //    da linha da FEM em 2024, que veio sem código de projeto/atividade.
  if (codigoOsg.includes("/") && idx.pares.has(`${ano}|${codigoOsg}`))
    return { ...separarPar(codigoOsg), origem: "codigo-osg", candidatos: [] };

  // 6. Nada resolveu. A unidade fica vazia e o aviso carrega os candidatos, para
  //    que virem entrada de `EXCECOES_UNIDADE`.
  return {
    orgaoCodigo: orgaoOsg,
    unidadeCodigo: "",
    origem: "",
    candidatos: doOrgao.length ? doOrgao : candidatos,
  };
}
