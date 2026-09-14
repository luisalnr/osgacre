/**
 * Confere os links do legis.ac.gov.br do seed de leis.
 *
 *   npx tsx scripts/conferir-links.ts
 *
 * Abre cada URL e compara o cabeçalho oficial da norma com o número e a data do
 * registro. Só lê — nada é gravado, nem no seed nem no banco.
 *
 * Por que existe: busca no portal devolve, com aparência de acerto, normas que
 * apenas *alteram* ou *citam* a procurada. Um link errado é pior que link nenhum,
 * porque manda o leitor para uma norma que existe e parece certa.
 *
 * **Usa `curl`, não `fetch`.** O legis.ac.gov.br não serve o certificado
 * intermediário: o fetch do Node falha com UNABLE_TO_VERIFY_LEAF_SIGNATURE em todas
 * as URLs. O curl do sistema completa a cadeia e responde 200 com verificação
 * normal — por isso nada de `-k` aqui: se a verificação falhar, é para falhar.
 */
import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";

const execFileP = promisify(execFile);

const seed = path.join(process.cwd(), "public", "data", "seed-leis.json");

type Lei = {
  tipo: string;
  numero: string;
  data: string;
  ementa: string;
  url: string;
};

const MESES = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

const semAcento = (s: string) =>
  s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

/** Só os dígitos: "Lei nº 4.753" e "LEI Nº 4.753" viram "4753". */
const soDigitos = (s: string) => s.replace(/\D/g, "");

/**
 * Espécie da norma. Sem isto, "Decreto nº 4.511" e "Lei nº 4.511" — que existem
 * os dois — passariam um pelo outro, porque só o número é comparado.
 */
function especie(s: string): "lei_complementar" | "decreto" | "lei" | "?" {
  const t = semAcento(s);
  if (t.includes("lei complementar")) return "lei_complementar";
  if (t.includes("decreto")) return "decreto";
  if (t.includes("lei")) return "lei";
  return "?";
}

type Data = { dia: number; mes: number; ano: number };

/** "31/12/2025" -> { dia: 31, mes: 12, ano: 2025 }. */
function dataDoRegistro(data: string): Data | null {
  const [dia, mes, ano] = data.split("/").map(Number);
  if (!dia || !mes || !ano || mes > 12) return null;
  return { dia, mes, ano };
}

/**
 * "DE 01 DE ABRIL DE 2026" -> { dia: 1, mes: 4, ano: 2026 }.
 *
 * Compara-se número a número, e não texto a texto: a página zera à esquerda
 * ("01 DE ABRIL") e o registro não ("1 de abril"), o que fazia todo dia de 1 a 9
 * parecer divergência.
 */
function dataDoCabecalho(trecho: string): Data | null {
  const m = semAcento(trecho).match(/(\d{1,2})\s+de\s+([a-zç]+)\s+de\s+(\d{4})/);
  if (!m) return null;
  const mes = MESES.findIndex((x) => semAcento(x) === m[2]) + 1;
  if (!mes) return null;
  return { dia: Number(m[1]), mes, ano: Number(m[3]) };
}

const mesmaData = (a: Data | null, b: Data | null) =>
  !!a && !!b && a.dia === b.dia && a.mes === b.mes && a.ano === b.ano;

/**
 * Todos os cabeçalhos próprios de norma na página, em caixa alta.
 *
 * Recolhe *todos* de propósito, em vez de ancorar no primeiro: as páginas em versão
 * "Compilado" repetem o cabeçalho institucional da Casa Civil e trazem a lista de
 * normas alteradoras antes do cabeçalho real. Citações a outras normas aparecem em
 * caixa mista ("Lei Complementar nº 45, de 1994"), o que as separa naturalmente.
 */
function cabecalhos(html: string): string[] {
  const texto = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ");
  const re =
    /(LEI COMPLEMENTAR|LEI|DECRETO)\s+N[ºO°]\s*[\d.]+\s*,\s*DE\s+\d{1,2}\s+DE\s+[A-ZÇÃÊÍÓÚÂÔ]+\s+DE\s+\d{4}/g;
  return [...new Set(texto.match(re) ?? [])];
}

async function baixar(url: string): Promise<string | null> {
  try {
    const { stdout } = await execFileP(
      "curl",
      ["-sS", "--max-time", "40", "-w", "\\n__HTTP__%{http_code}", url],
      { maxBuffer: 32 * 1024 * 1024 }
    );
    const corte = stdout.lastIndexOf("\n__HTTP__");
    if (corte < 0) return null;
    const status = stdout.slice(corte + 9).trim();
    return status === "200" ? stdout.slice(0, corte) : null;
  } catch {
    return null;
  }
}

const pausa = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const leis: Lei[] = JSON.parse(fs.readFileSync(seed, "utf8"));
  const comUrl = leis.filter((l) => l.url);
  const semUrl = leis.filter((l) => !l.url);

  console.log(
    `${leis.length} instrumentos — ${comUrl.length} com link, ${semUrl.length} sem.`
  );
  for (const l of semUrl) console.log(`  [sem link] ${l.tipo} · ${l.numero}`);
  console.log(`\nConferindo ${comUrl.length} páginas do legis.ac.gov.br...\n`);

  const diverge: string[] = [];
  const inconclusivo: string[] = [];
  const inacessivel: string[] = [];
  let confere = 0;

  for (let i = 0; i < comUrl.length; i++) {
    const l = comUrl[i];
    const html = await baixar(l.url);
    const rotulo = `${l.tipo} · ${l.numero} (${l.data})`;

    if (!html) {
      inacessivel.push(`${rotulo}\n      ${l.url}`);
    } else {
      const achados = cabecalhos(html);
      const numeroEsperado = soDigitos(l.numero);
      const dataEsperada = dataDoRegistro(l.data);
      const especieEsperada = especie(l.numero);
      const bate = achados.some((c) => {
        const cabeca = c.split(",")[0] ?? "";
        return (
          soDigitos(cabeca) === numeroEsperado &&
          especie(cabeca) === especieEsperada &&
          (!dataEsperada ||
            mesmaData(dataDoCabecalho(c.slice(c.indexOf(",") + 1)), dataEsperada))
        );
      });

      if (bate) confere++;
      else if (!achados.length)
        inconclusivo.push(`${rotulo}\n      ${l.url}`);
      else
        diverge.push(
          `${rotulo}\n      esperado: ${especieEsperada} nº ${numeroEsperado}, ${l.data}` +
            `\n      na página: ${achados.slice(0, 3).join(" | ")}` +
            `\n      ${l.url}`
        );
    }

    if ((i + 1) % 25 === 0 || i === comUrl.length - 1) {
      process.stdout.write(`  ${i + 1}/${comUrl.length}\n`);
    }
    await pausa(400);
  }

  console.log(`\n--- Resultado ---`);
  console.log(`  confere      ${confere}`);
  console.log(`  diverge      ${diverge.length}`);
  console.log(`  inconclusivo ${inconclusivo.length}`);
  console.log(`  inacessível  ${inacessivel.length}`);

  const secao = (titulo: string, itens: string[], nota: string) => {
    if (!itens.length) return;
    console.log(`\n### ${titulo}\n${nota}`);
    for (const it of itens) console.log(`  - ${it}`);
  };

  secao(
    "Divergem",
    diverge,
    "  A página existe, mas o cabeçalho é de outra norma. Conferir à mão."
  );
  secao(
    "Inconclusivos",
    inconclusivo,
    "  Nenhum cabeçalho reconhecível — pode ser layout diferente, não erro de link."
  );
  secao(
    "Inacessíveis",
    inacessivel,
    "  Não responderam 200. Pode ser instabilidade do portal; vale repetir."
  );

  if (!diverge.length && !inconclusivo.length && !inacessivel.length) {
    console.log("\nTodos os links conferem.");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
