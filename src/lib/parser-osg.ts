import { hashId } from "./id";
import { catalogoDeQdd, rotuloOrgao, type CatalogoOrgaos } from "./orgaos";
import {
  acharCabecalho as acharCabecalhoComum,
  mapearColunas as mapearColunasComum,
  numero,
  texto,
  type Aviso,
} from "./parser-comum";
import { chave, normalizarEixo, normalizarFuncao, ponderadorDe } from "./referencias";
import { indexarOrgaoUnidade, resolverUnidade } from "./resolver-unidade";
import type { DotacaoQdd, Registro } from "./types";

// Re-exportado porque `bloco-importacao.tsx` e `checagens-qdd.ts` importam o
// tipo daqui desde antes de existir um módulo comum de parsers.
export type { Aviso };

/** Colunas esperadas na aba Tabela_OSG, na ordem em que a planilha as traz. */
export const COLUNAS_OSG = [
  "Categoria",
  "Órgão",
  "Órgão_Sigla",
  "Aplicação Programada",
  "Função Orçamentária",
  "Programa",
  "Projeto Atividade",
  "Orçamento Aprovado",
  "Entregas Apropriadas",
  "Eixo",
  "Valor de Apropriação OSG",
  "Orçamento Final",
  "Valor Liquidado Projeto Todo",
  "Valor Liquidado e Apropriado OSG",
  "A Liquidar",
  "Ano",
] as const;

/** Sinônimos aceitos por coluna, caso a planilha mude de rótulo. */
const ALIASES: Record<string, string[]> = {
  Categoria: ["categoria"],
  "Órgão": ["orgao", "orgao/unidade", "unidade orcamentaria"],
  "Órgão_Sigla": ["orgao_sigla", "orgao sigla", "sigla"],
  "Aplicação Programada": ["aplicacao programada", "aplicacao", "dotacao"],
  "Função Orçamentária": ["funcao orcamentaria", "funcao"],
  Programa: ["programa"],
  "Projeto Atividade": ["projeto atividade", "projeto/atividade", "projeto"],
  "Orçamento Aprovado": ["orcamento aprovado", "aprovado"],
  "Entregas Apropriadas": ["entregas apropriadas", "entrega", "entregas"],
  Eixo: ["eixo", "eixo tematico"],
  "Valor de Apropriação OSG": [
    "valor de apropriacao osg",
    "apropriacao osg",
    "valor de apropriacao do osg",
  ],
  "Orçamento Final": ["orcamento final", "orcamento atualizado"],
  "Valor Liquidado Projeto Todo": [
    "valor liquidado projeto todo",
    "liquidado projeto todo",
    "valor liquidado do projeto",
  ],
  "Valor Liquidado e Apropriado OSG": [
    "valor liquidado e apropriado osg",
    "liquidado osg",
    "valor liquidado osg",
  ],
  "A Liquidar": ["a liquidar"],
  Ano: ["ano", "exercicio"],
};

/**
 * Correção de um valor que a Tabela OSG traz errado.
 *
 * `de` é o valor errado esperado, e não é enfeite: a correção só dispara quando
 * o erro está mesmo ali. É o mesmo princípio de `LINKS_LEIS_SEM_HYPERLINK` em
 * `referencias.ts` — reserva, não substituição. No dia em que a planilha de
 * origem for corrigida, a entrada fica inerte sozinha, sem precisar ser
 * removida, e não há como ela passar por cima de um dado que já estava certo.
 *
 * `ano`, `orgaoCodigo` e `projetoAtividade` são opcionais: omitidos, a correção
 * vale onde quer que o valor errado apareça. **Só omita quando o valor errado
 * for inválido em qualquer contexto.** Um código que existe e é legítimo em
 * outras dotações precisa de escopo, sob pena de reclassificar em silêncio
 * linhas que estavam certas.
 */
export type CorrecaoOSG = {
  campo: "programaCodigo" | "funcaoCodigo";
  de: string;
  para: string;
  ano?: number;
  orgaoCodigo?: string;
  projetoAtividade?: string;
  motivo: string;
};

/**
 * Erros de digitação conhecidos da Tabela OSG, que é preenchida à mão.
 *
 * Cada um foi conferido contra o **QDD**, que é a fonte oficial da classificação
 * funcional e programática: a `funcaoProgramatica` de lá traz função, subfunção
 * e programa da ação orçamentária, e é ela que decide quando os dois discordam.
 *
 * Esta tabela também dirige o `scripts/corrigir-classificacoes.ts`, que aplica
 * as mesmas correções aos registros já gravados no banco. Uma fonte só para as
 * duas coisas, para o código e o Neon não divergirem.
 */
export const CORRECOES_OSG: CorrecaoOSG[] = [
  {
    campo: "programaCodigo",
    de: "4431",
    para: "1443",
    motivo:
      "Transposição de dígitos. 4431 não existe no PPA; o QDD traz 1443 " +
      "(INFRAESTRUTURA E MOBILIDADE URBANA) para os projetos 10970000, 10980000 " +
      "e 10990000 da SEOP, em 2024 e 2025 — e a própria SEOP já usa 1443 em outra " +
      "dotação. Sem escopo porque 4431 é inválido em qualquer contexto.",
  },
  {
    campo: "funcaoCodigo",
    de: "11",
    para: "04",
    ano: 2025,
    orgaoCodigo: "762",
    projetoAtividade: "80285236",
    motivo:
      "A Tabela OSG classificou a EMENDA nº 18/2024 em 11 (Trabalho); o QDD traz " +
      "04 (Administração). Escopada à dotação de propósito: função 11 é legítima " +
      "em outras dez dotações da SETE e da própria SEMULHER, e um mapa por código " +
      "reclassificaria todas elas.",
  },
];

/**
 * Se esta correção vale para esta linha.
 *
 * O script que corrige o banco decide o mesmo, mas em SQL — condições no `WHERE`
 * de um `UPDATE`, que é o certo lá. Os dois precisam concordar, e o que garante
 * isso é `CORRECOES_OSG` ser a fonte única dos dois lados.
 */
function correcaoCasa(
  c: CorrecaoOSG,
  linha: {
    ano: number;
    orgaoCodigo: string;
    projetoAtividade: string;
    funcaoCodigo: string;
    programaCodigo: string;
  }
): boolean {
  if (linha[c.campo] !== c.de) return false;
  if (c.ano !== undefined && linha.ano !== c.ano) return false;
  // O órgão vem como "719/219" em algumas linhas; o código é o que vem antes.
  if (c.orgaoCodigo !== undefined && !linha.orgaoCodigo.startsWith(c.orgaoCodigo))
    return false;
  if (
    c.projetoAtividade !== undefined &&
    linha.projetoAtividade !== c.projetoAtividade
  )
    return false;
  return true;
}

function corrigir(
  linha: {
    ano: number;
    orgaoCodigo: string;
    projetoAtividade: string;
    funcaoCodigo: string;
    programaCodigo: string;
  },
  aoAplicar: (c: CorrecaoOSG) => void
): { funcaoCodigo: string; programaCodigo: string } {
  const fora = {
    funcaoCodigo: linha.funcaoCodigo,
    programaCodigo: linha.programaCodigo,
  };
  for (const c of CORRECOES_OSG) {
    if (!correcaoCasa(c, linha)) continue;
    fora[c.campo] = c.para;
    aoAplicar(c);
  }
  return fora;
}

export type ResultadoOSG = {
  registros: Registro[];
  totalLinhas: number;
  colunasEncontradas: Record<string, boolean>;
  anos: number[];
  avisos: Aviso[];
};

/**
 * Localiza a linha de cabeçalho em vez de assumir que é a primeira.
 *
 * `Categoria` + `Eixo` + `Ano` é o que identifica a Tabela OSG. O relatório de
 * Orçamentos Temáticos tem `Eixo` e `Ano` mas chama a categoria de
 * `Classificação`, então não é confundido com esta planilha.
 */
const acharCabecalho = (linhas: unknown[][]): number =>
  acharCabecalhoComum(linhas, [["categoria"], ["eixo"], ["ano", "exercicio"]]);

const mapearColunas = (cabecalho: unknown[]): Map<string, number> =>
  mapearColunasComum(cabecalho, COLUNAS_OSG, ALIASES);

/**
 * Converte a Tabela_OSG em registros (um por entrega apropriada).
 *
 * Detalhe que muda o resultado: `Orçamento Aprovado`, `Orçamento Final`,
 * `Valor Liquidado Projeto Todo` e `A Liquidar` chegam RATEADOS pelo número de
 * linhas do grupo (ano, projeto/atividade). Somá-los sobre o grupo inteiro
 * devolve os totais da dotação, gravados em `orcAprovadoProjeto`,
 * `orcFinalProjeto` e `liqProjetoTotal`. Como o rateio ignora o órgão, esses
 * totais nunca podem ser recalculados dentro do recorte por órgão.
 *
 * O denominador do "peso do OSG na dotação" é o orçamento APROVADO do projeto:
 * apropriação e aprovado são ambos números de planejamento, e a razão entre eles
 * reproduz a metodologia — categoria 1 dá 100% e categoria 3 dá 50%. Usar o
 * orçamento atualizado no lugar produziria pesos acima de 100% sempre que a
 * dotação encolhesse durante o exercício.
 *
 * `qdd` são as linhas do QDD dos exercícios que a planilha cobre, e é com elas
 * que órgão e unidade são resolvidos e nomeados — ver `resolver-unidade.ts`.
 * Sem QDD carregado a importação não falha: grava o código que a planilha traz,
 * deixa a unidade vazia e avisa. É o mesmo recuo de `checarContraQdd`, porque
 * bloquear a importação inteira por causa do QDD ausente seria pior do que
 * importar e sinalizar.
 */
export function parseTabelaOSG(
  linhas: unknown[][],
  qdd: DotacaoQdd[] = []
): ResultadoOSG {
  const avisos: Aviso[] = [];
  const cabecalhoIdx = acharCabecalho(linhas);
  if (cabecalhoIdx < 0) {
    return {
      registros: [],
      totalLinhas: 0,
      colunasEncontradas: Object.fromEntries(
        COLUNAS_OSG.map((c) => [c, false])
      ) as Record<string, boolean>,
      anos: [],
      avisos: [
        {
          nivel: "erro",
          mensagem:
            "Não encontrei a linha de cabeçalho. A aba precisa ter as colunas Categoria, Eixo e Ano.",
          linhas: [],
        },
      ],
    };
  }

  const indiceQdd = indexarOrgaoUnidade(qdd);
  const catalogo: CatalogoOrgaos = catalogoDeQdd(qdd);

  const mapa = mapearColunas(linhas[cabecalhoIdx]);
  const colunasEncontradas = Object.fromEntries(
    COLUNAS_OSG.map((c) => [c, mapa.has(c)])
  ) as Record<string, boolean>;

  const col = (linha: unknown[], nome: string): unknown => {
    const i = mapa.get(nome);
    return i === undefined ? "" : linha[i];
  };

  // Os campos deixados de fora só existem depois do agrupamento (os totais de
  // projeto e de dotação) ou são derivados na materialização — não há o que ler
  // deles na linha da planilha.
  type Bruto = Omit<
    Registro,
    | "id"
    | "orcAprovadoProjeto"
    | "orcFinalProjeto"
    | "liqProjetoTotal"
    | "tema"
    | "ciclo"
    | "ponderador"
    | "planejadoDotacao"
    | "planejadoOrigem"
    | "planejadoEntrega"
    | "liqDotacao"
    | "funcaoProgramatica"
    | "entregaDescricao"
    | "quantidade"
    | "municipio"
    | "publicoBeneficiado"
  > & { linhaPlanilha: number };
  const brutos: Bruto[] = [];
  const eixosDesconhecidos: number[] = [];
  const correcoesAplicadas = new Map<CorrecaoOSG, number[]>();
  const categoriasInvalidas: number[] = [];
  const funcoesDesconhecidas: number[] = [];
  const semUnidade: { linha: number; codigo: string; candidatos: string[] }[] = [];
  const executorDiferente: { linha: number; de: string; para: string }[] = [];

  for (let i = cabecalhoIdx + 1; i < linhas.length; i++) {
    const linha = linhas[i] ?? [];
    const ano = Math.trunc(numero(col(linha, "Ano")));
    const projeto = texto(col(linha, "Projeto Atividade"));
    const aplicacao = texto(col(linha, "Aplicação Programada"));
    // Linha vazia ou de totalização: sem ano e sem dotação não há o que importar.
    if (!ano || (!projeto && !aplicacao)) continue;

    // O código composto da planilha ("721/302", "754") é só a chave de busca:
    // quem decide órgão, unidade e os dois nomes é o QDD.
    const siglaPlanilha =
      texto(col(linha, "Órgão_Sigla")) || texto(col(linha, "Órgão"));
    const codigoOsg = (siglaPlanilha.match(/^[\d/]+/)?.[0] ?? "").trim();
    const res = resolverUnidade(
      { ano, codigoOsg, projetoAtividade: projeto },
      indiceQdd
    );
    const orgaoCodigo = res.orgaoCodigo;
    const unidadeCodigo = res.unidadeCodigo;
    const orgaoNome = catalogo.orgaos.get(orgaoCodigo) ?? "";
    const unidadeNome =
      catalogo.unidades.get(`${orgaoCodigo}/${unidadeCodigo}`) ?? "";
    if (!unidadeCodigo)
      semUnidade.push({
        linha: i + 1,
        codigo: siglaPlanilha,
        candidatos: res.candidatos,
      });
    if (res.origem === "outro-orgao" && codigoOsg.split("/")[0] !== orgaoCodigo)
      executorDiferente.push({
        linha: i + 1,
        de: siglaPlanilha,
        para: rotuloOrgao(orgaoCodigo, catalogo),
      });

    const eixoBruto = texto(col(linha, "Eixo"));
    const eixo = normalizarEixo(eixoBruto);
    if (!eixo && eixoBruto) eixosDesconhecidos.push(i + 1);

    const categoria = Math.trunc(numero(col(linha, "Categoria")));
    if (![1, 2, 3].includes(categoria)) categoriasInvalidas.push(i + 1);

    const funcaoCodigo = normalizarFuncao(texto(col(linha, "Função Orçamentária")));
    if (!funcaoCodigo) funcoesDesconhecidas.push(i + 1);

    const programaCodigo = texto(col(linha, "Programa"));
    const corrigido = corrigir(
      { ano, orgaoCodigo, projetoAtividade: projeto, funcaoCodigo, programaCodigo },
      (c) => {
        const linhas = correcoesAplicadas.get(c) ?? [];
        linhas.push(i + 1);
        correcoesAplicadas.set(c, linhas);
      }
    );

    brutos.push({
      linhaPlanilha: i + 1,
      ano,
      categoria,
      orgaoCodigo,
      orgaoNome,
      unidadeCodigo,
      unidadeNome,
      aplicacaoProgramada: aplicacao,
      projetoAtividade: projeto,
      funcaoCodigo: corrigido.funcaoCodigo,
      programaCodigo: corrigido.programaCodigo,
      eixo: eixo ?? chave(eixoBruto).replace(/\s+/g, "-"),
      entrega: texto(col(linha, "Entregas Apropriadas")),
      apropOsg: numero(col(linha, "Valor de Apropriação OSG")),
      liqOsg: numero(col(linha, "Valor Liquidado e Apropriado OSG")),
      orcAprovado: numero(col(linha, "Orçamento Aprovado")),
      orcFinal: numero(col(linha, "Orçamento Final")),
      liqProjeto: numero(col(linha, "Valor Liquidado Projeto Todo")),
      aLiquidar: numero(col(linha, "A Liquidar")),
    });
  }

  // Totais da dotação inteira = soma do rateio sobre (ano, projeto/atividade).
  type Grupo = { aprovado: number; final: number; liquidado: number; aprop: number };
  const grupos = new Map<string, Grupo>();
  for (const b of brutos) {
    const k = `${b.ano}|${b.projetoAtividade}`;
    const g = grupos.get(k) ?? { aprovado: 0, final: 0, liquidado: 0, aprop: 0 };
    g.aprovado += b.orcAprovado;
    g.final += b.orcFinal;
    g.liquidado += b.liqProjeto;
    g.aprop += b.apropOsg;
    grupos.set(k, g);
  }

  /**
   * Planejado e liquidado no nível da dotação, para os campos que o relatório de
   * Orçamentos Temáticos informa direto e esta planilha não.
   *
   * Aqui eles são a soma das entregas da dotação — que é o que a Tabela OSG
   * traz, uma linha por entrega já com o valor apropriado. Preenchê-los é o que
   * deixa 2024, 2025 e 2026 comparáveis pelo mesmo campo, em vez de cada
   * exercício responder por um caminho diferente.
   *
   * O agrupamento é por (ano, órgão/unidade, projeto), e NÃO por (ano, projeto)
   * como os totais acima: a mesma ação orçamentária existe na Unidade Gestora e
   * num fundo do mesmo órgão, com valores diferentes, e é o par que identifica a
   * dotação. Os totais de projeto acima usam a chave mais frouxa porque é assim
   * que o rateio da planilha foi construído.
   */
  const porDotacao = new Map<string, { aprop: number; liq: number }>();
  for (const b of brutos) {
    const k = `${b.ano}|${b.orgaoCodigo}/${b.unidadeCodigo}|${b.projetoAtividade}`;
    const g = porDotacao.get(k) ?? { aprop: 0, liq: 0 };
    g.aprop += b.apropOsg;
    g.liq += b.liqOsg;
    porDotacao.set(k, g);
  }

  const ordinal = new Map<string, number>();
  const registros: Registro[] = brutos.map((b) => {
    const k = `${b.ano}|${b.projetoAtividade}`;
    const chaveId = `${k}|${b.orgaoCodigo}/${b.unidadeCodigo}`;
    const chaveDotacao = `${b.ano}|${b.orgaoCodigo}/${b.unidadeCodigo}|${b.projetoAtividade}`;
    const n = (ordinal.get(chaveId) ?? 0) + 1;
    ordinal.set(chaveId, n);
    return {
      id: hashId(
        b.ano,
        b.projetoAtividade,
        b.orgaoCodigo,
        b.unidadeCodigo,
        b.categoria,
        b.entrega,
        n
      ),
      ano: b.ano,
      categoria: b.categoria,
      orgaoCodigo: b.orgaoCodigo,
      orgaoNome: b.orgaoNome,
      unidadeCodigo: b.unidadeCodigo,
      unidadeNome: b.unidadeNome,
      aplicacaoProgramada: b.aplicacaoProgramada,
      projetoAtividade: b.projetoAtividade,
      funcaoCodigo: b.funcaoCodigo,
      programaCodigo: b.programaCodigo,
      eixo: b.eixo,
      entrega: b.entrega,
      apropOsg: b.apropOsg,
      liqOsg: b.liqOsg,
      orcAprovado: b.orcAprovado,
      orcFinal: b.orcFinal,
      liqProjeto: b.liqProjeto,
      aLiquidar: b.aLiquidar,
      orcAprovadoProjeto: grupos.get(k)?.aprovado ?? 0,
      orcFinalProjeto: grupos.get(k)?.final ?? 0,
      liqProjetoTotal: grupos.get(k)?.liquidado ?? 0,
      // Campos que só o relatório de Orçamentos Temáticos traz. Aqui recebem o
      // que esta fonte permite derivar, para que os exercícios sejam comparáveis
      // pelos mesmos campos; o resto fica vazio porque o dado não existia.
      tema: "OSG",
      ciclo: "",
      ponderador: ponderadorDe(b.categoria),
      planejadoDotacao: porDotacao.get(chaveDotacao)?.aprop ?? 0,
      // Nesta fonte o valor é sempre o que o COSG apurou e escreveu na planilha,
      // inclusive nas emendas parlamentares. A derivação pela dotação atualizada
      // só existe no relatório de 2026 em diante, que reporta emenda como zero.
      planejadoOrigem: "relatorio",
      // A Tabela OSG traz uma linha por entrega já com o valor apropriado: todo
      // valor é discriminado, nenhum é rateio.
      planejadoEntrega: b.apropOsg,
      liqDotacao: porDotacao.get(chaveDotacao)?.liq ?? 0,
      funcaoProgramatica: "",
      entregaDescricao: "",
      quantidade: 0,
      municipio: "",
      publicoBeneficiado: "",
    };
  });

  // Checagens mostradas na prévia da importação.
  const liqMaiorQueAprop = brutos
    .filter((b) => b.liqOsg > b.apropOsg + 0.01)
    .map((b) => b.linhaPlanilha);
  // A conferência da apropriação contra o tamanho da dotação NÃO é feita aqui:
  // a planilha traz o orçamento aprovado, que não cobre remanejamentos nem
  // emendas parlamentares. `checagens-qdd.ts` tem a conferência contra o QDD
  // pronta para isso, mas hoje nenhum caminho a chama — o aviso abaixo é o que
  // sinaliza o caso.
  const semProjetoAtividade = brutos
    .filter((b) => !b.projetoAtividade)
    .map((b) => b.linhaPlanilha);

  // Correção aplicada é fato do dado, não detalhe de implementação: aparece no
  // log do data:build e na prévia do /admin, em vez de acontecer escondida.
  for (const [c, linhas] of correcoesAplicadas) {
    avisos.push({
      nivel: "aviso",
      mensagem:
        c.campo === "programaCodigo"
          ? `Corrigido o programa ${c.de} para ${c.para}. ${c.motivo}`
          : `Corrigida a função ${c.de} para ${c.para}. ${c.motivo}`,
      linhas,
    });
  }

  // Órgão e unidade: o que a resolução contra o QDD não fechou sozinha.
  if (!qdd.length) {
    avisos.push({
      nivel: "aviso",
      mensagem:
        "Nenhum QDD foi carregado para os exercícios desta planilha, então " +
        "órgão e unidade não puderam ser resolvidos. Os registros ficam com o " +
        "código da planilha e sem unidade orçamentária até o QDD ser importado.",
      linhas: [],
    });
  } else if (semUnidade.length) {
    avisos.push({
      nivel: "erro",
      mensagem:
        `Não consegui determinar a unidade orçamentária de ${semUnidade.length} ` +
        "linha(s). Cada uma precisa de uma entrada em EXCECOES_UNIDADE " +
        "(src/lib/resolver-unidade.ts): " +
        semUnidade
          .map(
            (u) =>
              `${u.codigo} → ${u.candidatos.length ? u.candidatos.join(" ou ") : "nenhum candidato no QDD"}`
          )
          .join(" · "),
      linhas: semUnidade.map((u) => u.linha),
    });
  }
  if (executorDiferente.length)
    avisos.push({
      nivel: "aviso",
      mensagem:
        `Em ${executorDiferente.length} linha(s) a planilha registrou o órgão ` +
        "que executou a entrega, e a dotação, no QDD, está em outro órgão. " +
        "Prevalece o do QDD: " +
        [...new Set(executorDiferente.map((e) => `${e.de} → ${e.para}`))].join(" · "),
      linhas: executorDiferente.map((e) => e.linha),
    });

  if (eixosDesconhecidos.length)
    avisos.push({
      nivel: "erro",
      mensagem: "Eixo fora da lista da Lei nº 4.168/2023.",
      linhas: eixosDesconhecidos,
    });
  if (categoriasInvalidas.length)
    avisos.push({
      nivel: "erro",
      mensagem: "Categoria fora do intervalo 1 a 3.",
      linhas: categoriasInvalidas,
    });
  if (funcoesDesconhecidas.length)
    avisos.push({
      nivel: "aviso",
      mensagem: "Função orçamentária vazia ou não numérica.",
      linhas: funcoesDesconhecidas,
    });
  if (liqMaiorQueAprop.length)
    avisos.push({
      nivel: "aviso",
      mensagem: "Liquidado do OSG maior que a apropriação planejada.",
      linhas: liqMaiorQueAprop,
    });
  if (semProjetoAtividade.length)
    avisos.push({
      nivel: "aviso",
      mensagem:
        "Linha sem código de projeto/atividade — não dá para casar com o QDD nem calcular a participação do OSG na dotação.",
      linhas: semProjetoAtividade,
    });

  const anos = [...new Set(registros.map((r) => r.ano))].sort();
  return { registros, totalLinhas: registros.length, colunasEncontradas, anos, avisos };
}
