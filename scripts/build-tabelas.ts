/**
 * Converte o `TABELAS.xlsx` da raiz nas tabelas de referência de
 * `src/lib/tabelas.ts`.
 *
 *   npm run data:tabelas
 *
 * Roda à mão, e de propósito fora do `data:build`: o `TABELAS.xlsx` está no
 * `.gitignore` como as demais planilhas de origem, então o `data:build` precisa
 * continuar rodando em máquina que não tenha o arquivo. O que vai para o git é
 * o `tabelas.ts` gerado — é ele a fonte que o site consulta em produção.
 *
 * As classificações são estáveis (Portaria MOG nº 42/1999, Portaria
 * Interministerial STN/SOF nº 163/2001, Portaria STN nº 710/2021), então
 * regerar é evento raro: entra aqui quando o Estado publica fonte nova ou
 * programa novo no PPA.
 */
import fs from "node:fs";
import path from "node:path";
import { lerAbas, type Aba } from "../src/lib/xlsx-io";

const raiz = process.cwd();
const origem = path.join(raiz, "TABELAS.xlsx");
const destino = path.join(raiz, "src", "lib", "tabelas.ts");

/**
 * Abas que este script ignora, e por quê — para ninguém "corrigir" a omissão.
 *
 * `Parlamentar`, `CatEconomica Receita` e `Origem Receita` foram descartadas na
 * definição do trabalho: as duas últimas são o lado da receita, e o painel só
 * trata despesa. `FunçõesSubfunções` lista os pares válidos entre função e
 * subfunção; não validamos combinações, lemos a subfunção direto dos dígitos da
 * função programática do QDD.
 */
const IGNORADAS = [
  "Parlamentar",
  "CatEconomica Receita",
  "Origem Receita",
  "FunçõesSubfunções",
];

const texto = (v: unknown): string =>
  v === null || v === undefined ? "" : String(v).replace(/\s+/g, " ").trim();

function acharAba(abas: Aba[], nome: string): Aba {
  const alvo = nome.toLowerCase();
  const a = abas.find((x) => x.nome.trim().toLowerCase() === alvo);
  if (!a) throw new Error(`Aba "${nome}" não encontrada no TABELAS.xlsx.`);
  return a;
}

/**
 * Lê uma aba no formato código/descrição.
 *
 * Sempre as duas primeiras colunas, **nunca a terceira**. A terceira é o
 * "código - descrição" pré-concatenado da planilha, e em `GrupoNaturezaDespesa`
 * ela traz `"33 - Outras Despesas Correntes"`: 33 é categoria econômica + grupo
 * grudados, coisa diferente do código de um dígito da primeira coluna.
 *
 * `String()` no código não é decorativo: `CategoriaEconômica` volta do leitor
 * como número, e um `3` numérico não indexa um `Record<string, string>`.
 */
function lerTabela(abas: Aba[], nome: string): Record<string, string> {
  const aba = acharAba(abas, nome);
  const fora: Record<string, string> = {};
  for (const linha of aba.linhas.slice(1)) {
    const codigo = texto(linha?.[0]);
    const descricao = texto(linha?.[1]);
    if (!codigo || !descricao) continue;
    fora[codigo] = descricao;
  }
  return fora;
}

/** Programa → eixo do PPA, da quarta coluna da aba `ProgramasTemáticos`. */
function lerEixosPpa(abas: Aba[]): Record<string, string> {
  const aba = acharAba(abas, "ProgramasTemáticos");
  const fora: Record<string, string> = {};
  for (const linha of aba.linhas.slice(1)) {
    const codigo = texto(linha?.[0]);
    const eixo = texto(linha?.[3]);
    if (!codigo || !eixo) continue;
    fora[codigo] = eixo;
  }
  return fora;
}

/**
 * Descrições em que a cauda repete um pedaço do começo — defeito de digitação
 * na planilha de origem, não coisa que este script deva adivinhar como corrigir.
 *
 * Ex.: "GESTÃO INTEGRADA E DEMOCRATIZADA DA CULTURA DA CULTURA". Só relatamos,
 * para a correção acontecer na fonte e valer para todo mundo que a usa.
 */
function suspeitasDeDuplicacao(tabela: Record<string, string>): string[] {
  const achados: string[] = [];
  for (const [codigo, descricao] of Object.entries(tabela)) {
    const palavras = descricao.split(" ").filter(Boolean);
    for (let n = 4; n >= 2; n--) {
      if (palavras.length < n * 2) continue;
      const cauda = palavras.slice(-n).join(" ");
      const antes = palavras.slice(0, -n).join(" ");
      if (antes.includes(cauda)) {
        achados.push(`${codigo}: …${cauda}`);
        break;
      }
    }
  }
  return achados;
}

function serializar(nome: string, doc: string, tabela: Record<string, string>): string {
  const linhas = Object.entries(tabela)
    .map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)},`)
    .join("\n");
  return `${doc}\nexport const ${nome}: Record<string, string> = {\n${linhas}\n};\n`;
}

const abas = lerAbas(fs.readFileSync(origem));
console.log(`TABELAS.xlsx: ${abas.length} abas`);
for (const a of abas) {
  if (IGNORADAS.includes(a.nome)) console.log(`  ignorada: ${a.nome}`);
}

const subfuncoes = lerTabela(abas, "Subfunções");
const programas = lerTabela(abas, "ProgramasTemáticos");
const eixosPpa = lerEixosPpa(abas);
const categoriasEconomicas = lerTabela(abas, "CategoriaEconômica");
const gruposNatureza = lerTabela(abas, "GrupoNaturezaDespesa");
const modalidades = lerTabela(abas, "ModalidadeAplicação");
const elementos = lerTabela(abas, "ElementoDespesa");
const fontes = lerTabela(abas, "Fonte");

const blocos = [
  serializar(
    "SUBFUNCOES",
    "/** Subfunções — Portaria MOG nº 42/1999. Código de três dígitos. */",
    subfuncoes
  ),
  serializar(
    "PROGRAMAS_TEMATICOS",
    "/** Programas temáticos do PPA. Código de quatro dígitos. */",
    programas
  ),
  serializar(
    "EIXO_PPA_POR_PROGRAMA",
    `/**
 * Programa do PPA → eixo do PPA.
 *
 * **Este eixo NÃO é o eixo do OSG.** O eixo do OSG são os seis do art. 4º da Lei
 * estadual nº 4.168/2023, em \`EIXOS\` (referencias.ts), que dão as cores e os
 * gráficos do painel inteiro. Este aqui é o eixo temático do PPA estadual, outra
 * classificação com o mesmo nome. Os dois só aparecem lado a lado na planilha de
 * exportação, com rótulos que os distinguem; na tela, "eixo" quer dizer o do OSG.
 */`,
    eixosPpa
  ),
  serializar(
    "CATEGORIAS_ECONOMICAS",
    "/** Categoria econômica da despesa — primeiro dígito da conta de despesa. */",
    categoriasEconomicas
  ),
  serializar(
    "GRUPOS_NATUREZA",
    "/** Grupo de natureza da despesa — segundo dígito da conta de despesa. */",
    gruposNatureza
  ),
  serializar(
    "MODALIDADES_APLICACAO",
    "/** Modalidade de aplicação — terceiro e quarto dígitos da conta de despesa. */",
    modalidades
  ),
  serializar(
    "ELEMENTOS_DESPESA",
    "/** Elemento de despesa — quinto e sexto dígitos da conta de despesa. */",
    elementos
  ),
  serializar(
    "FONTES",
    `/**
 * Fontes de recurso, no padrão de oito dígitos da Portaria STN nº 710/2021.
 *
 * O QDD traz códigos que não estão aqui — inclusive alguns de sete dígitos, que
 * parecem truncados na origem. Por isso \`nomeFonte\` devolve o código nu quando
 * não encontra, e nada neste projeto normaliza o comprimento do código: mexer no
 * comprimento transformaria um código malformado em outro código válido.
 */`,
    fontes
  ),
];

const cabecalho = `// GERADO POR scripts/build-tabelas.ts — NÃO EDITE À MÃO.
// Fonte: TABELAS.xlsx (raiz do projeto, fora do git). Para regerar:
//   npm run data:tabelas
//
// Classificações orçamentárias oficiais. Os helpers que as consultam — nomeFuncao,
// nomeSubfuncao, nomeFonte e companhia — moram em referencias.ts.
`;

fs.writeFileSync(destino, `${cabecalho}\n${blocos.join("\n")}`, "utf8");

const conta = (t: Record<string, string>) => Object.keys(t).length;
console.log(`\n  subfunções ............ ${conta(subfuncoes)}`);
console.log(`  programas temáticos ... ${conta(programas)}`);
console.log(`  eixos do PPA .......... ${new Set(Object.values(eixosPpa)).size} (em ${conta(eixosPpa)} programas)`);
console.log(`  categorias econômicas . ${conta(categoriasEconomicas)}`);
console.log(`  grupos de natureza .... ${conta(gruposNatureza)}`);
console.log(`  modalidades ........... ${conta(modalidades)}`);
console.log(`  elementos de despesa .. ${conta(elementos)}`);
console.log(`  fontes de recurso ..... ${conta(fontes)}`);
console.log(`  -> src/lib/tabelas.ts`);

const suspeitas = suspeitasDeDuplicacao(programas);
if (suspeitas.length) {
  console.log(
    `\n[conferir na planilha] ${suspeitas.length} descrição(ões) de programa com a cauda repetida.`
  );
  console.log("Não corrigi nada: o defeito é da origem e a correção deve valer lá.");
  for (const s of suspeitas) console.log(`  ${s}`);
}

const eixosDistintos = [...new Set(Object.values(eixosPpa))].sort();
const parecidos = eixosDistintos.filter((a) =>
  eixosDistintos.some((b) => b !== a && b.startsWith(a))
);
if (parecidos.length) {
  console.log(
    `\n[conferir na planilha] eixos do PPA em que um é prefixo de outro — pode ser proposital, pode ser digitação:`
  );
  for (const e of parecidos) console.log(`  "${e}"`);
}
