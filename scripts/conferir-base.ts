/**
 * Conferência dos números do OSG contra os seeds — teste de regressão.
 *
 *     npx tsx scripts/conferir-base.ts
 *
 * Sai com código 1 quando qualquer medida diverge de `ESPERADO`, e imprime a
 * divergência no formato `esperado x obtido`. Rode depois de toda reimportação
 * e de qualquer mudança em `agregacoes.ts`.
 *
 * `ESPERADO` e a tabela de *Conferência* do README são a mesma linha de base e
 * se atualizam juntos: mudou um número aqui de propósito, mude lá também (e
 * vice-versa). Um número que muda sem intenção é o que este script existe para
 * pegar.
 *
 * As razões de categoria 1 e 3 são o sinal de que a regra da base continua
 * certa: na categoria 1 o OSG apropria a dotação inteira (100%) e na 3 apropria
 * metade (50%), então o quociente `planejado ÷ dotação inicial` tem de cair
 * exatamente nesses valores. As dotações que fogem disso estão listadas ao
 * final, com o motivo — elas são poucas, conhecidas e contadas na linha de base.
 */
import fs from "node:fs";
import path from "node:path";
import {
  agruparEmDotacoes,
  calcularTotais,
  indexarQdd,
  pesoNaDotacao,
  type SituacaoDotacao,
} from "../src/lib/agregacoes";
import type { Dotacao, DotacaoQdd, Registro } from "../src/lib/types";

/** Situações esperadas por exercício; as ausentes valem zero. */
type Situacoes = Partial<Record<SituacaoDotacao, number>>;

type Esperado = {
  entregas: number;
  dotacoes: number;
  /** Planejado em reais, como o README publica. Comparado em centavos. */
  planejado: number;
  /** `null` para exercício em apuração: `calcularTotais` devolve `liq` nulo. */
  liquidado: number | null;
  situacoes: Situacoes;
  emendas: number;
  /** Dotações de categoria única 1 com percentual: quantas em 100% de quantas. */
  cat1: [emCem: number, total: number];
  /** Idem para a categoria 3, em 50%. */
  cat3: [emCinquenta: number, total: number];
};

/**
 * O que as razões de categoria significam muda com a fonte, e é por isso que
 * elas não são a mesma checagem nos dois períodos.
 *
 * Em **2026 em diante** o planejado é calculado pelo Sistema de Orçamentos
 * Temáticos como `ponderador × dotação inicial`, então a razão é uma
 * *invariante*: 100% na categoria 1 e 50% na 3, sem exceção. Qualquer desvio
 * ali é defeito de leitura, e por isso o esperado é a totalidade.
 *
 * Em **2024 e 2025** o valor vem da coluna `Valor de Apropriação OSG` da Tabela
 * OSG, apurada à mão pelo COSG. A razão tende a 100% e 50% porque é assim que a
 * apropriação é pensada, mas nada obriga: as dotações fora do canône, listadas
 * ao final, são apropriações que o Comitê fez por outro critério. Ali o número
 * esperado é apenas a contagem observada, que serve para acusar mudança.
 */

/**
 * Linha de base. Fonte: tabela de *Conferência* do README, que por sua vez sai
 * dos relatórios publicados pelo COSG.
 */
const ESPERADO: Record<number, Esperado> = {
  2024: {
    entregas: 82,
    dotacoes: 62,
    planejado: 171_143_631.23,
    liquidado: 114_622_947.14,
    situacoes: { normal: 60, suplementada: 1, "a-conferir": 1 },
    emendas: 9,
    cat1: [18, 18],
    cat3: [24, 26],
  },
  2025: {
    entregas: 103,
    dotacoes: 89,
    planejado: 220_468_189.96,
    liquidado: 140_031_314.55,
    situacoes: { normal: 83, suplementada: 4, "a-conferir": 2 },
    emendas: 17,
    cat1: [25, 26],
    cat3: [37, 41],
  },
  2026: {
    entregas: 169,
    dotacoes: 121,
    planejado: 262_607_886.87,
    // Exercício em apuração: `calcularTotais` suprime o liquidado de propósito.
    liquidado: null,
    situacoes: {
      normal: 110,
      suplementada: 7,
      "a-conferir": 1,
      "sem-dotacao-inicial": 1,
      indisponivel: 2,
    },
    // 18 = as 16 que receberam valor derivado do QDD mais as 2 cuja dotação
    // atualizada também está zerada (as duas `indisponivel` acima).
    emendas: 18,
    // Invariante do Sistema de Orçamentos Temáticos: totalidade nos dois casos.
    cat1: [30, 30],
    cat3: [53, 53],
  },
};

/** Corte de 2026 por categoria, em reais. Também publicado no README. */
const CATEGORIAS_2026: Record<number, number> = {
  1: 39_498_032.84,
  2: 88_318_450.56,
  3: 134_791_403.47,
};

/**
 * Emendas parlamentares de 2026 com o planejado recuperado da dotação
 * atualizada do QDD. Decisão do COSG em 10/09/2026: o relatório reporta zero
 * para todas, porque emenda entra na LOA zerada por construção.
 *
 * `aindaZeradas` conta as emendas do exercício que continuam em zero, e elas
 * ficam de **fora** de `quantidade`: sem dotação atualizada não há de onde
 * derivar, então `planejadoOrigem` nem chega a virar `dotacao-atualizada`.
 * As duas somadas dão as 18 emendas de 2026.
 */
const EMENDAS_DERIVADAS_2026 = { quantidade: 16, total: 1_112_400.0, aindaZeradas: 2 };

const ler = <T>(n: string): T[] =>
  JSON.parse(fs.readFileSync(path.join(process.cwd(), "public", "data", n), "utf8"));

const brl = (v: number | null) =>
  v === null ? "—" : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const pct = (v: number | null) => (v === null ? "—" : v.toFixed(1) + "%");

/**
 * Dinheiro é comparado em centavos inteiros, nunca em float: 2026 tem dois
 * valores com fração de centavo, e a soma só fecha porque `centavos()` arredonda
 * a metade para o par. Um `===` entre floats acusaria diferença onde não há.
 */
const cents = (v: number) => Math.round(v * 100);

const registros = ler<Registro>("seed-osg.json");
const qdd = indexarQdd(ler<DotacaoQdd>("seed-qdd.json"));
const dotacoes = agruparEmDotacoes(registros);

const falhas: string[] = [];
const conferir = (medida: string, esperado: unknown, obtido: unknown) => {
  if (esperado !== obtido) falhas.push(`${medida}: esperado ${esperado} x obtido ${obtido}`);
};

const exato = (a: number[], alvo: number) =>
  a.filter((x) => Math.abs(x - alvo) < 0.5).length;

/** Dotações fora do percentual canônico da sua categoria, para inspeção. */
const foraDoCanone: string[] = [];

const linha = (d: Dotacao, p: ReturnType<typeof pesoNaDotacao>) =>
  `${d.ano}/${d.projetoAtividade || "sem código"} ${d.orgaoCodigo}/${d.unidadeCodigo}` +
  ` cat${d.categorias.join(",")} — planejado ${brl(d.apropOsg)}` +
  ` | inicial ${brl(p.base.inicial)} | atualizada ${brl(p.base.atualizada)}`;

const anos = [...new Set(dotacoes.map((d) => d.ano))].sort();

for (const ano of anos) {
  const esperado = ESPERADO[ano];
  const doAno = dotacoes.filter((d) => d.ano === ano);
  const registrosDoAno = registros.filter((r) => r.ano === ano);
  const totais = calcularTotais(registrosDoAno);

  const situacoes: Record<string, number> = {};
  const origens: Record<string, number> = {};
  const fora: Record<SituacaoDotacao, string[]> = {
    normal: [],
    suplementada: [],
    "a-conferir": [],
    "sem-dotacao-inicial": [],
    indisponivel: [],
  };
  const cat1: number[] = [];
  const cat3: number[] = [];
  let emendas = 0;

  for (const d of doAno) {
    const p = pesoNaDotacao(d, qdd);
    situacoes[p.base.situacao] = (situacoes[p.base.situacao] ?? 0) + 1;
    origens[p.base.origem] = (origens[p.base.origem] ?? 0) + 1;
    if (p.base.ehEmenda) emendas++;
    if (p.base.situacao !== "normal") fora[p.base.situacao].push(linha(d, p));
    if (p.percentual !== null && d.categorias.length === 1) {
      const canone = d.categorias[0] === 1 ? 100 : d.categorias[0] === 3 ? 50 : null;
      if (d.categorias[0] === 1) cat1.push(p.percentual);
      if (d.categorias[0] === 3) cat3.push(p.percentual);
      if (canone !== null && Math.abs(p.percentual - canone) >= 0.5) {
        foraDoCanone.push(`${linha(d, p)} | percentual ${pct(p.percentual)} (canônico ${canone}%)`);
      }
    }
  }

  console.log(`\n=== ${ano} ===`);
  console.log(
    `entregas ${totais.entregas} | dotações ${totais.dotacoes} | planejado ${brl(totais.aprop)}` +
      ` | liquidado ${brl(totais.liq)}${totais.emApuracao ? " (em apuração)" : ""}`
  );
  console.log(`emendas parlamentares: ${emendas}`);
  console.log("situação:", situacoes);
  console.log("origem da base:", origens);
  console.log(
    `categoria 1 em 100%: ${exato(cat1, 100)}/${cat1.length}` +
      ` | categoria 3 em 50%: ${exato(cat3, 50)}/${cat3.length}`
  );
  for (const estado of ["suplementada", "a-conferir", "sem-dotacao-inicial", "indisponivel"] as const) {
    if (fora[estado].length) {
      console.log(`  ${estado} (${fora[estado].length}):`);
      fora[estado].forEach((x) => console.log("    " + x));
    }
  }

  if (!esperado) {
    falhas.push(`${ano}: exercício sem linha de base em ESPERADO`);
    continue;
  }
  conferir(`${ano} entregas`, esperado.entregas, totais.entregas);
  conferir(`${ano} dotações`, esperado.dotacoes, totais.dotacoes);
  conferir(`${ano} planejado`, cents(esperado.planejado), cents(totais.aprop));
  conferir(
    `${ano} liquidado`,
    esperado.liquidado === null ? null : cents(esperado.liquidado),
    totais.liq === null ? null : cents(totais.liq)
  );
  conferir(`${ano} emendas`, esperado.emendas, emendas);
  for (const estado of [
    "normal",
    "suplementada",
    "a-conferir",
    "sem-dotacao-inicial",
    "indisponivel",
  ] as const) {
    conferir(`${ano} situação ${estado}`, esperado.situacoes[estado] ?? 0, situacoes[estado] ?? 0);
  }
  conferir(`${ano} cat1 em 100%`, esperado.cat1[0], exato(cat1, 100));
  conferir(`${ano} cat1 total`, esperado.cat1[1], cat1.length);
  conferir(`${ano} cat3 em 50%`, esperado.cat3[0], exato(cat3, 50));
  conferir(`${ano} cat3 total`, esperado.cat3[1], cat3.length);
}

// --- Corte de 2026 por categoria -------------------------------------------
console.log("\n=== 2026 por categoria ===");
for (const [cat, alvo] of Object.entries(CATEGORIAS_2026)) {
  const soma = registros
    .filter((r) => r.ano === 2026 && r.categoria === Number(cat))
    .reduce((s, r) => s + r.apropOsg, 0);
  console.log(`  categoria ${cat}: ${brl(soma)}`);
  conferir(`2026 categoria ${cat}`, cents(alvo), cents(soma));
}

// --- Emendas derivadas da dotação atualizada (2026) -------------------------
const derivadas = dotacoes.filter(
  (d) => d.ano === 2026 && d.planejadoOrigem === "dotacao-atualizada"
);
const totalDerivado = derivadas.reduce((s, d) => s + d.apropOsg, 0);
// Zeradas se contam sobre TODAS as emendas do exercício, e não sobre as
// derivadas: a que continua em zero é justamente a que não teve de onde derivar.
const aindaZeradas = dotacoes.filter(
  (d) => d.ano === 2026 && pesoNaDotacao(d, qdd).base.ehEmenda && d.apropOsg === 0
).length;
console.log("\n=== emendas com planejado derivado do QDD (2026) ===");
console.log(
  `  ${derivadas.length} emendas | ${brl(totalDerivado)} | ${aindaZeradas} ainda zeradas`
);
conferir("2026 emendas derivadas", EMENDAS_DERIVADAS_2026.quantidade, derivadas.length);
conferir("2026 emendas derivadas (total)", cents(EMENDAS_DERIVADAS_2026.total), cents(totalDerivado));
conferir("2026 emendas ainda zeradas", EMENDAS_DERIVADAS_2026.aindaZeradas, aindaZeradas);

// --- Casos de referência ----------------------------------------------------
// Cada um documenta uma decisão específica: a suplementada que não vira
// percentual, a emenda que usa a atualizada, a emenda cuja atualizada iguala a
// inicial, a `a-conferir` que nem a atualizada cobre, e a dotação normal que
// encolheu no exercício sem deixar de ser normal.
console.log("\n=== casos de referência ===");
for (const [ano, proj] of [
  [2025, "12190000"],
  [2025, "80285678"],
  [2024, "80285073"],
  [2025, "21870000"],
  [2024, "10180000"],
] as const) {
  const d = dotacoes.find((x) => x.ano === ano && x.projetoAtividade === proj);
  if (!d) {
    falhas.push(`caso de referência ${ano}/${proj}: não encontrada`);
    console.log(`  ${ano}/${proj}: NÃO ENCONTRADA`);
    continue;
  }
  const p = pesoNaDotacao(d, qdd);
  console.log(
    `  ${ano}/${proj} ${d.orgaoCodigo}/${d.unidadeCodigo} cat ${d.categorias.join(",")} -> ${pct(p.percentual)}` +
      ` [${p.base.situacao}${p.base.ehEmenda ? ", emenda" : ""}, ${p.base.origem}]` +
      ` | inicial ${brl(p.base.inicial)} | atualizada ${brl(p.base.atualizada)}`
  );
}

// --- Dotações fora do percentual canônico ------------------------------------
console.log(`\n=== fora do percentual canônico (${foraDoCanone.length}) ===`);
foraDoCanone.forEach((x) => console.log("  " + x));

// --- Resultado ---------------------------------------------------------------
if (falhas.length) {
  console.error(`\n${falhas.length} divergência(s) em relação à linha de base:`);
  falhas.forEach((f) => console.error("  " + f));
  console.error(
    "\nSe a mudança foi intencional, atualize ESPERADO aqui e a tabela de Conferência do README."
  );
  process.exit(1);
}
console.log("\nTudo conforme a linha de base.");
