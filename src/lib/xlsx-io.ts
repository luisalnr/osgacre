import * as XLSX from "xlsx";

export type Aba = {
  nome: string;
  /** Matriz de células já normalizada (strings/numbers), linha 0 = primeira linha da planilha. */
  linhas: unknown[][];
  /** Hyperlinks por referência de célula (ex.: "B10" → "https://legis.ac.gov.br/detalhar/5737"). */
  links: Map<string, string>;
};

/**
 * Lê um .xlsx em memória e devolve todas as abas como matriz + os hyperlinks.
 * Os links importam porque é neles que mora a URL do legis.ac.gov.br de cada
 * instrumento legal — a célula mostra o número da lei, não o endereço.
 */
export function lerAbas(data: ArrayBuffer | Uint8Array): Aba[] {
  const buf = data instanceof Uint8Array ? data : new Uint8Array(data);
  const wb = XLSX.read(buf, { type: "array" });
  return wb.SheetNames.map((nome) => {
    const ws = wb.Sheets[nome];
    const linhas = XLSX.utils.sheet_to_json<unknown[]>(ws, {
      header: 1,
      defval: "",
      raw: true,
    }) as unknown[][];
    const links = new Map<string, string>();
    for (const ref of Object.keys(ws)) {
      if (ref.startsWith("!")) continue;
      const cell = ws[ref] as XLSX.CellObject & { l?: { Target?: string } };
      const alvo = cell?.l?.Target;
      if (alvo) links.set(ref, alvo);
    }
    return { nome, linhas, links };
  });
}

/** Converte índice de coluna (0) em letra ("A"), para casar com o mapa de links. */
export function letraColuna(indice: number): string {
  let n = indice;
  let s = "";
  do {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return s;
}

export const refCelula = (linha: number, coluna: number) =>
  `${letraColuna(coluna)}${linha + 1}`;
