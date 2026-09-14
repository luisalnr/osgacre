import { chave } from "./referencias";

/**
 * Utilitários compartilhados pelos parsers de planilha.
 *
 * Existem porque o OSG tem hoje duas fontes de registro em paralelo — a Tabela
 * OSG manual, que responde por 2024 e 2025, e o relatório do Sistema de
 * Orçamentos Temáticos, que responde por 2026 em diante. Os dois layouts são
 * diferentes e cada parser tem as suas próprias exceções, mas a mecânica de ler
 * uma planilha é a mesma: achar o cabeçalho, casar as colunas por sinônimo e
 * converter célula em texto ou número.
 *
 * Duplicar essa mecânica seria o caminho mais curto para os dois divergirem em
 * silêncio: bastaria alguém corrigir a leitura de "R$ 1.234,56" num arquivo e
 * não no outro para que dois exercícios do mesmo painel passassem a interpretar
 * a mesma célula de dois jeitos.
 */

export type Aviso = {
  nivel: "erro" | "aviso";
  mensagem: string;
  linhas: number[];
};

export function texto(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v).replace(/\s+/g, " ").trim();
}

/** Aceita 1234.56, "1.234,56" e "R$ 1.234,56". */
export function numero(v: unknown): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const t = texto(v);
  if (!t) return 0;
  const limpo = t
    .replace(/[^0-9,.-]/g, "")
    .replace(/\.(?=\d{3}(\D|$))/g, "")
    .replace(",", ".");
  const n = Number(limpo);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Como `numero`, mas devolvendo `null` para célula vazia.
 *
 * A distinção importa nas colunas em que o vazio quer dizer alguma coisa. No
 * relatório de Orçamentos Temáticos há duas: o `Ponderador`, vazio na categoria
 * 2 porque ali não existe fator, e o `Planejado da Entrega`, vazio quando a
 * fonte não discrimina o valor por entrega. Ler as duas com `numero` devolveria
 * zero, que quer dizer outra coisa — apropriação nula.
 */
export function numeroOuNulo(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  return texto(v) === "" ? null : numero(v);
}

/**
 * Acha a linha do cabeçalho pelas colunas que só ele tem.
 *
 * `obrigatorias` é uma lista de grupos de sinônimos: a linha só é aceita se
 * casar com pelo menos um sinônimo de CADA grupo. Isso é o que distingue duas
 * planilhas parecidas — a Tabela OSG e o relatório novo têm ambos `Eixo` e
 * `Ano`, e só uma tem `Planejado ponderado`.
 */
export function acharCabecalho(
  linhas: unknown[][],
  obrigatorias: readonly (readonly string[])[],
  limite = 30
): number {
  for (let i = 0; i < Math.min(linhas.length, limite); i++) {
    const celulas = (linhas[i] ?? []).map((c) => chave(texto(c)));
    if (obrigatorias.every((grupo) => celulas.some((c) => grupo.includes(c)))) return i;
  }
  return -1;
}

/**
 * Casa os rótulos do cabeçalho com as colunas esperadas.
 *
 * Duas passadas: primeiro por igualdade exata, depois por conteúdo — e a segunda
 * só com sinônimos de mais de quatro caracteres, para que um alias curto como
 * "ano" não case com "planejado ponderado" por acidente.
 */
export function mapearColunas(
  cabecalho: unknown[],
  colunas: readonly string[],
  aliases: Record<string, string[]> = {}
): Map<string, number> {
  const normalizadas = cabecalho.map((c) => chave(texto(c)));
  const mapa = new Map<string, number>();
  for (const coluna of colunas) {
    const candidatos = [chave(coluna), ...(aliases[coluna] ?? [])];
    let indice = normalizadas.findIndex((c) => candidatos.includes(c));
    if (indice < 0) {
      indice = normalizadas.findIndex((c) =>
        candidatos.some((a) => a.length > 4 && c.includes(a))
      );
    }
    if (indice >= 0) mapa.set(coluna, indice);
  }
  return mapa;
}

/**
 * Converte reais em centavos inteiros, arredondando a metade para o par.
 *
 * O relatório de Orçamentos Temáticos traz valores com fração de centavo — em
 * 2026 são dois, R$ 1.684.233,805 e R$ 3.474.893,875 —, e a coluna do banco tem
 * duas casas. Alguma coisa se perde; a questão é o quê.
 *
 * Arredondar a metade para cima, que é o reflexo, enviesa: as duas frações sobem
 * juntas e o total do exercício fica 1 centavo acima da soma exata, R$
 * 261.495.486,88 contra R$ 261.495.486,87. Arredondar para o par não tem
 * direção — as frações caem para lados diferentes e o total se preserva. É a
 * convenção usual em rateio financeiro exatamente por isso, e aqui é o que faz o
 * painel reproduzir o total do relatório ao centavo.
 *
 * O arredondamento em 6 casas antes do teste elimina o ruído do ponto flutuante:
 * `1684233.805 * 100` é `168423380.50000003` em binário, e sem isso a metade
 * nunca seria reconhecida como metade.
 */
export function centavos(reais: number): number {
  if (!Number.isFinite(reais)) return 0;
  const escalado = Number((reais * 100).toFixed(6));
  const piso = Math.floor(escalado);
  const resto = escalado - piso;
  if (Math.abs(resto - 0.5) > 1e-9) return Math.round(escalado);
  return piso % 2 === 0 ? piso : piso + 1;
}

/**
 * Reparte um valor entre `n` parcelas de duas casas cuja soma devolve o valor
 * exato, com os centavos do resto na primeira parcela.
 *
 * A divisão simples não serve. O planejado é gravado com `toFixed(2)`, então uma
 * dotação de R$ 578.243,00 em 8 entregas daria 72.280,375 → 72.280,38 em cada
 * uma, e a soma devolveria R$ 578.243,04. Multiplicado pelas dotações rateadas,
 * o total do exercício deixaria de fechar com o relatório publicado — e um
 * painel que não reproduz o número oficial ao centavo é um painel que ninguém
 * consegue defender numa reunião.
 *
 * `pesos` distribui proporcionalmente em vez de igualmente; sem ele, ou com
 * pesos que somam zero, a divisão é igual.
 */
export function repartir(total: number, n: number, pesos?: number[]): number[] {
  if (n <= 0) return [];
  const total_ = centavos(total);
  const somaPesos = pesos?.reduce((s, p) => s + Math.max(0, p), 0) ?? 0;
  const usar = pesos && somaPesos > 0 ? pesos.map((p) => Math.max(0, p)) : null;

  const parcelas: number[] = [];
  let distribuido = 0;
  for (let i = 0; i < n; i++) {
    const bruto = usar
      ? Math.round((total_ * usar[i]) / somaPesos)
      : Math.round(total_ / n);
    parcelas.push(bruto);
    distribuido += bruto;
  }
  // O resto vai na primeira parcela para que a soma seja exata.
  parcelas[0] += total_ - distribuido;
  return parcelas.map((c) => c / 100);
}
