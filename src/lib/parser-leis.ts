import { hashId } from "./id";
import type { Lei, TipoLei } from "./types";
import type { Aba } from "./xlsx-io";
import { refCelula } from "./xlsx-io";

/**
 * Converte as seis abas do "HISTÓRICO DE LEIS ORÇAMENTO SENSÍVEL AO GÊNERO.xlsx"
 * em instrumentos legais.
 *
 * Duas particularidades da planilha:
 *  - A célula do número traz número, data e publicação no DOE grudados
 *    ("Lei nº 4.798, de 01/04/2026Publicada no DOE de 02/04/2026").
 *  - O link do legis.ac.gov.br não está em nenhuma coluna: é o hyperlink
 *    embutido na própria célula do número. Sem ele não há "ver na íntegra".
 *
 * As colunas de valor da aba LOA (RP, OUTRAS FONTES, TOTAL LOA) são descartadas
 * de propósito — esta seção mostra apenas a citação e o link do documento.
 */

const ABAS: { nome: string; tipo: TipoLei; rotulo: string }[] = [
  { nome: "Lei Ordinária", tipo: "lei_ordinaria", rotulo: "Leis ordinárias" },
  { nome: "Decreto", tipo: "decreto", rotulo: "Decretos" },
  {
    nome: "Estrutura básica da adm",
    tipo: "estrutura",
    rotulo: "Estrutura da administração",
  },
  { nome: "PPA", tipo: "ppa", rotulo: "Plano Plurianual" },
  { nome: "LDO", tipo: "ldo", rotulo: "Diretrizes orçamentárias" },
  { nome: "LOA", tipo: "loa", rotulo: "Lei orçamentária anual" },
];

export const ROTULO_TIPO: Record<TipoLei, string> = Object.fromEntries(
  ABAS.map((a) => [a.tipo, a.rotulo])
) as Record<TipoLei, string>;

export const ORDEM_TIPOS: TipoLei[] = ABAS.map((a) => a.tipo);

function texto(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v).replace(/\s+/g, " ").trim();
}

/** Quebra "Lei nº X, de dd/mm/aaaaPublicada no DOE de dd/mm/aaaa" em três partes. */
export function separarNumero(bruto: string): {
  numero: string;
  data: string;
  doe: string;
} {
  const t = texto(bruto);
  if (!t) return { numero: "", data: "", doe: "" };
  const doeMatch = t.match(
    /Publicad[oa]\s*n[oa]?\s*DOE\s*(?:de\s*)?(\d{2}\/\d{2}\/\d{4})/i
  );
  const doe = doeMatch?.[1] ?? "";
  const semDoe = t.replace(/Publicad[oa][\s\S]*$/i, "").trim();
  const dataMatch = semDoe.match(/(\d{2}\/\d{2}\/\d{4})\s*$/);
  const data = dataMatch?.[1] ?? "";
  const numero = semDoe
    .replace(/,?\s*de\s*\d{2}\/\d{2}\/\d{4}\s*$/, "")
    .replace(/,\s*$/, "")
    .trim();
  return { numero: numero || semDoe, data, doe };
}

/** A linha de cabeçalho é a que traz "Ementa"; acima dela só há metadados. */
function acharCabecalho(linhas: unknown[][]): number {
  for (let i = 0; i < Math.min(linhas.length, 15); i++) {
    const celulas = (linhas[i] ?? []).map((c) => texto(c).toLowerCase());
    if (celulas.some((c) => c === "ementa")) return i;
  }
  return -1;
}

export type ResultadoLeis = {
  leis: Lei[];
  porTipo: Record<string, number>;
  abasIgnoradas: string[];
};

export function parseHistoricoLeis(abas: Aba[]): ResultadoLeis {
  const leis: Lei[] = [];
  const porTipo: Record<string, number> = {};
  const encontradas = new Set<string>();

  for (const aba of abas) {
    const meta = ABAS.find(
      (a) => a.nome.toLowerCase() === aba.nome.trim().toLowerCase()
    );
    if (!meta) continue;
    encontradas.add(aba.nome);

    const cabecalho = acharCabecalho(aba.linhas);
    if (cabecalho < 0) continue;

    const titulos = (aba.linhas[cabecalho] ?? []).map((c) =>
      texto(c).toLowerCase()
    );
    const colOrgao = titulos.findIndex((t) => t === "órgão" || t === "orgao");
    const colNome = titulos.findIndex((t) => t === "nome");
    const colSensivel = titulos.findIndex((t) => t.includes("sensível ao gênero"));
    const colCitacoes = titulos.findIndex((t) => t.includes("citações"));
    const colMetas = titulos.findIndex((t) => t.includes("metas"));

    for (let i = cabecalho + 1; i < aba.linhas.length; i++) {
      const linha = aba.linhas[i] ?? [];
      const bruto = texto(linha[1]);
      const ementa = texto(linha[2]);
      if (!bruto && !ementa) continue;
      if (!bruto) continue;

      const { numero, data, doe } = separarNumero(bruto);
      // O link mora no hyperlink da célula B, não em uma coluna.
      const url = aba.links.get(refCelula(i, 1)) ?? "";
      const orgao = [
        colOrgao >= 0 ? texto(linha[colOrgao]) : "",
        colNome >= 0 ? texto(linha[colNome]) : "",
      ]
        .filter(Boolean)
        .join(" — ");

      leis.push({
        id: hashId(meta.tipo, numero, data, i),
        tipo: meta.tipo,
        ordem: Number(texto(linha[0]).replace(/\D/g, "")) || 0,
        numero,
        data,
        doe,
        ementa,
        orgao,
        // Alguns links da planilha ainda apontam para http://www.legis...
        url: url ? url.replace(/^http:\/\/(www\.)?/, "https://") : "",
        sensivelGenero: colSensivel >= 0 ? texto(linha[colSensivel]) : "",
        citacoes: colCitacoes >= 0 ? texto(linha[colCitacoes]) : "",
        metas: colMetas >= 0 ? texto(linha[colMetas]) : "",
      });
      porTipo[meta.tipo] = (porTipo[meta.tipo] ?? 0) + 1;
    }
  }

  const abasIgnoradas = ABAS.filter((a) => !encontradas.has(a.nome)).map(
    (a) => a.nome
  );
  return { leis, porTipo, abasIgnoradas };
}
