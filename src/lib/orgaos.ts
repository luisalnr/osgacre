import type { DotacaoQdd } from "./types";

/**
 * Catálogo canônico de órgãos e unidades orçamentárias.
 *
 * A fonte é o **QDD** do exercício, e só ele: é o único lugar do sistema onde
 * órgão e unidade chegam separados, cada um com código e nome próprios, e onde
 * cada código tem um nome só — conferido nos exercícios de 2024 e 2025, sem
 * nenhuma divergência interna. A Tabela OSG traz os dois fundidos numa string
 * (`721/302 - FUNDHACRE`), preenchida à mão, e por isso nunca manda no nome.
 *
 * `TABELAS.xlsx` não tem aba de órgãos, então não há de onde gerar uma tabela
 * estática como `SUBFUNCOES` ou `FONTES` em `tabelas.ts`. O catálogo é montado
 * em memória a partir do QDD já carregado, o que tem a vantagem de acompanhar
 * sozinho a criação de unidades novas a cada exercício — 2025 trouxe seis que
 * não existiam em 2024 (452, 718, 102/647, 451/648, 714/649, 719/646).
 */
export type CatalogoOrgaos = {
  /** `"721"` → `"SECRETARIA DE ESTADO DE SAÚDE - SESACRE"` */
  orgaos: Map<string, string>;
  /** `"721/302"` → `"FUNDAÇÃO HOSPITAL ESTADUAL DO ACRE- FUNDHACRE"` */
  unidades: Map<string, string>;
};

/** Chave de unidade usada em todo o sistema: `"721/302"`. */
export const chaveUnidade = (orgao: string, unidade: string) =>
  `${orgao}/${unidade}`;

/**
 * Quebras de linha que o relatório do QDD gravou dentro do nome.
 *
 * O QDD é gerado com os nomes quebrados numa largura fixa de coluna, e a quebra
 * entrou no texto: sobrou `"MEIO AMBIEN TE"` onde se lê `"MEIO AMBIENTE"`. São
 * pares de fragmento, e não nomes inteiros, para que a mesma quebra seja
 * corrigida onde quer que reapareça — inclusive num nome que só exista a partir
 * de 2026, que ninguém teria como cadastrar antes.
 *
 * Mesmo princípio de reserva de `CORRECOES_OSG` em `parser-osg.ts`: cada par só
 * dispara quando o fragmento errado está mesmo no texto, e fica inerte sozinho
 * no dia em que a origem for corrigida, sem precisar ser removido daqui.
 *
 * O que NÃO está aqui é tão importante quanto o que está: `"ACRE- FUNDHACRE"` e
 * `"FUNDES- GASTOS"` têm o mesmo formato de quebra, mas ali o hífen é separador
 * legítimo de sigla. Ver `juntarHifenQuebrado` abaixo.
 */
export const FRAGMENTOS_QUEBRADOS: { de: string; para: string }[] = [
  { de: "MEIO AMBIEN TE", para: "MEIO AMBIENTE" },
  { de: "ES TADO", para: "ESTADO" },
  { de: "PENITEN- CIÁRIA", para: "PENITENCIÁRIA" },
  { de: "DESENVOLVI - MENTO", para: "DESENVOLVIMENTO" },
  { de: "DIREIT OS", para: "DIREITOS" },
  { de: "PAGAMEN TO", para: "PAGAMENTO" },
  { de: "D EFENSORIA", para: "DEFENSORIA" },
];

/**
 * Junta a palavra partida por hífen no fim da linha, quando é seguro.
 *
 * A regra ingênua — hífen colado à esquerda mais espaço, junta — erra em dois
 * dos sete nomes que altera, e um deles é o caso mais visível do painel:
 * `"FUNDAÇÃO HOSPITAL ESTADUAL DO ACRE- FUNDHACRE"` viraria `"ACREFUNDHACRE"`,
 * e `"FUNDES- GASTOS CORPORATIVOS"`, `"FUNDESGASTOS"`. Nos dois, o hífen separa
 * a sigla do nome; não é quebra de linha nenhuma.
 *
 * O que separa um caso do outro é o tamanho do fragmento à direita: quebra de
 * linha deixa um pedaço de palavra (`LE`, `TO`, `SOA`, `TE`), enquanto sigla e
 * palavra inteira são maiores. Quatro letras é o corte que separa os 126 nomes
 * reais dos dois QDDs sem nenhum falso positivo. Fragmento maior que isso fica
 * para `FRAGMENTOS_QUEBRADOS`, decidido caso a caso.
 */
const juntarHifenQuebrado = (s: string) =>
  s.replace(/(\p{L})-\s+(\p{L}{1,4})(?=\s|$)/gu, "$1$2");

/**
 * Nomes em que o QDD omitiu o " - " que separa a sigla do nome.
 *
 * Lista à parte de `FRAGMENTOS_QUEBRADOS` porque a correção é de outra natureza:
 * lá se conserta quebra de linha, aqui se restaura um separador que o relatório
 * usa em todos os outros nomes e esqueceu neste. Quem depende disso é
 * `siglaCurta`, que procura a sigla depois do hífen — sem ele, o órgão 720
 * chegava ao gráfico com os 42 caracteres do nome inteiro.
 *
 * Roda depois de `FRAGMENTOS_QUEBRADOS`, e é essa ordem que faz o par funcionar:
 * o nome cru traz "MEIO AMBIEN TE SEMA", que só vira "MEIO AMBIENTE SEMA" depois
 * da limpeza da quebra.
 *
 * As sete unidades com o mesmo defeito — IMAC, ITERACRE, JUCEAC, FADES,
 * FUNESBOM, FUNDESEG e ACREDATA — ainda não estão aqui. Entram uma a uma, como
 * esta: no mesmo formato aparecem nomes que terminam em "DO ACRE", "CASA CIVIL"
 * e "DE PESSOAS", em que a última palavra não é sigla nenhuma, e nenhuma regra
 * automática separa os dois casos.
 */
const SIGLAS_SEM_HIFEN: { de: string; para: string }[] = [
  { de: "MEIO AMBIENTE SEMA", para: "MEIO AMBIENTE - SEMA" },
];

/** Nome do QDD pronto para exibição: espaços colapsados e quebras remendadas. */
export function limparNome(bruto: string): string {
  let s = String(bruto ?? "").replace(/\s+/g, " ").trim();
  s = juntarHifenQuebrado(s);
  for (const { de, para } of FRAGMENTOS_QUEBRADOS) s = s.split(de).join(para);
  for (const { de, para } of SIGLAS_SEM_HIFEN) s = s.split(de).join(para);
  return s;
}

/**
 * Separa `"721 SECRETARIA DE ESTADO DE SAÚDE - SESACRE"` em código e nome.
 *
 * Serve tanto para as células do QDD quanto para o código composto da Tabela
 * OSG (`"721/302 - FUNDHACRE"`), e por isso aceita a barra no código.
 */
export function separarCodigo(bruto: string): { codigo: string; nome: string } {
  const t = String(bruto ?? "").replace(/\s+/g, " ").trim();
  const m = t.match(/^([\d/]+)\s*-?\s*(.*)$/);
  if (!m) return { codigo: "", nome: t };
  return { codigo: m[1].trim(), nome: m[2].trim() };
}

/** Monta o catálogo a partir das linhas do QDD de um ou mais exercícios. */
export function catalogoDeQdd(dotacoes: DotacaoQdd[]): CatalogoOrgaos {
  const orgaos = new Map<string, string>();
  const unidades = new Map<string, string>();
  for (const d of dotacoes) {
    if (!d.orgaoCodigo) continue;
    if (d.orgaoNome) orgaos.set(d.orgaoCodigo, limparNome(d.orgaoNome));
    if (d.unidadeCodigo && d.unidadeNome)
      unidades.set(
        chaveUnidade(d.orgaoCodigo, d.unidadeCodigo),
        limparNome(d.unidadeNome)
      );
  }
  return { orgaos, unidades };
}

export const CATALOGO_VAZIO: CatalogoOrgaos = {
  orgaos: new Map(),
  unidades: new Map(),
};

/**
 * `"721 SECRETARIA DE ESTADO DE SAÚDE - SESACRE"`.
 *
 * Sem o nome, devolve o código nu — mesma escolha do `rotulador` de
 * `referencias.ts`: um código sozinho ainda informa, um traço não.
 */
export function rotuloOrgao(codigo: string, cat: CatalogoOrgaos): string {
  if (!codigo) return "";
  const nome = cat.orgaos.get(codigo);
  return nome ? `${codigo} ${nome}` : codigo;
}

/** `"302 FUNDAÇÃO HOSPITAL ESTADUAL DO ACRE- FUNDHACRE"`. */
export function rotuloUnidade(
  orgaoCodigo: string,
  unidadeCodigo: string,
  cat: CatalogoOrgaos
): string {
  if (!unidadeCodigo) return "";
  const nome = cat.unidades.get(chaveUnidade(orgaoCodigo, unidadeCodigo));
  return nome ? `${unidadeCodigo} ${nome}` : unidadeCodigo;
}

/**
 * Palavras curtas legítimas, para `nomeSuspeito` não acusar nome são.
 *
 * Preposições e artigos do português mais as siglas de até três letras que
 * aparecem inteiras nos nomes do QDD.
 */
const CURTAS_LEGITIMAS = new Set([
  "DE", "DA", "DO", "DAS", "DOS", "E", "A", "O", "AS", "OS", "EM", "AO", "AOS",
  "À", "ÀS", "NA", "NO", "COM", "PARA", "SUP", "PÚB", "EST", "ESP", "ORÇ",
  "SÃO", "BEM", "SA", "CGE", "ISE", "IMC", "FEM", "FEH", "FT", "AC", "PGE",
  "SEE", "FDS", "FAC", "FDA", "SEC",
]);

/**
 * Hífens colados que são separador de sigla, não quebra de linha.
 *
 * `juntarHifenQuebrado` já os deixa em paz, porque o fragmento à direita passa
 * de quatro letras. Eles precisam estar aqui também para que `nomeSuspeito` não
 * os acuse: sem esta lista, os dois disparariam o aviso em toda importação, e um
 * aviso que sempre aparece é um aviso que ninguém lê. Registrar a exceção custa
 * duas linhas e preserva a checagem para uma quebra nova de verdade.
 */
const HIFENS_LEGITIMOS = ["ACRE- FUNDHACRE", "FUNDES- GASTOS"];

/**
 * Se o nome ainda parece ter quebra de linha grudada depois da limpeza.
 *
 * Alimenta o aviso da importação. Não corrige nada: o objetivo é que uma quebra
 * nova, num nome que só exista a partir de 2026, apareça para alguém decidir em
 * vez de entrar calada. Nos dois QDDs atuais, esta checagem fica limpa depois
 * das correções de `FRAGMENTOS_QUEBRADOS`.
 */
export function nomeSuspeito(nome: string): boolean {
  const semLegitimos = HIFENS_LEGITIMOS.reduce(
    (s, h) => s.split(h).join(""),
    nome
  );
  if (/\p{L}-\s+\p{L}/u.test(semLegitimos)) return true;
  const tokens = nome.split(" ");
  for (let i = 1; i < tokens.length - 1; i++) {
    const t = tokens[i].replace(/[.,]/g, "");
    if (!t || t.length > 3) continue;
    if (!/^\p{Lu}+$/u.test(t)) continue;
    if (!CURTAS_LEGITIMAS.has(t)) return true;
  }
  return false;
}

/**
 * Rótulo curto para gráfico: a sigla no fim do nome, ou o nome inteiro.
 *
 * Os nomes canônicos do QDD são longos demais para o eixo de um gráfico de
 * barras (`"SECRETARIA DE ESTADO DA JUSTIÇA E SEGURANÇA PÚBLICA - SEJUSP"`), e
 * quase todos terminam na sigla depois de um hífen. Quem não termina — a
 * Assembleia Legislativa, o Tribunal de Contas, a Casa Militar — não tem sigla
 * para extrair, e aí o nome inteiro é a resposta certa, truncado pelo gráfico.
 *
 * Note que isto é função de exibição, não dado: a sigla deixou de ser gravada
 * quando órgão e unidade passaram a ter código e nome próprios, justamente para
 * não haver duas grafias da mesma coisa no banco.
 *
 * Passa por `limparNome` antes de procurar o hífen, e isso não é zelo: o nome
 * pode chegar de uma linha gravada no banco ANTES de a limpeza existir, e aí o
 * separador que a busca precisa não está lá. Era o caso do órgão 720, que
 * aparecia no gráfico com os 42 caracteres do nome inteiro por causa de um
 * hífen que o QDD não escreveu. `limparNome` é idempotente, então normalizar de
 * novo um nome já limpo não custa nada além da passada.
 */
export function siglaCurta(bruto: string): string {
  const nome = limparNome(bruto);
  const m = nome.match(/-\s*([^-]{2,20})$/);
  const sigla = m?.[1]?.trim() ?? "";
  // Só vale como sigla se for curta e sem espaço: "- COHAB/ACRE" serve,
  // "- FOLHA DE PAGAMENTO DE PESSOAL / SAÚDE" é continuação do nome.
  return sigla && !sigla.includes(" ") ? sigla : nome;
}
