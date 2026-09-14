import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { CODIGOS_ODS_POR_EIXO, FONTES_ODS } from "../src/lib/ods-mapeamento";

type StatusApi =
  | "Produzido"
  | "Em análise/construção"
  | "Sem dados"
  | "Sem metodologia"
  | "Não se aplica ao Brasil";

type IndicadorApi = {
  numero: string;
  nome: string;
  status: StatusApi;
  possui_ficha: boolean;
};

type MetaApi = {
  numero: string;
  nome: string;
  indicadores: IndicadorApi[] | null;
};

const OBJETIVOS = [
  [1, "Erradicação da pobreza", "#e5243b"],
  [2, "Fome zero e agricultura sustentável", "#dda63a"],
  [3, "Saúde e bem-estar", "#4c9f38"],
  [4, "Educação de qualidade", "#c5192d"],
  [5, "Igualdade de gênero", "#ff3a21"],
  [6, "Água potável e saneamento", "#26bde2"],
  [7, "Energia limpa e acessível", "#fcc30b"],
  [8, "Trabalho decente e crescimento econômico", "#a21942"],
  [9, "Indústria, inovação e infraestrutura", "#fd6925"],
  [10, "Redução das desigualdades", "#dd1367"],
  [11, "Cidades e comunidades sustentáveis", "#fd9d24"],
  [12, "Consumo e produção responsáveis", "#bf8b2e"],
  [13, "Ação contra a mudança global do clima", "#3f7e44"],
  [14, "Vida na água", "#0a97d9"],
  [15, "Vida terrestre", "#56c02b"],
  [16, "Paz, justiça e instituições eficazes", "#00689d"],
  [17, "Parcerias e meios de implementação", "#19486a"],
  [18, "Igualdade étnico-racial", "#8a3715"],
] as const;

const STATUS = {
  Produzido: "produzido",
  "Em análise/construção": "em-analise",
  "Sem dados": "sem-dados",
  "Sem metodologia": "sem-metodologia",
  "Não se aplica ao Brasil": "nao-se-aplica",
} as const satisfies Record<StatusApi, string>;

const eixosPorCodigo = new Map<string, string[]>();
for (const [eixo, codigos] of Object.entries(CODIGOS_ODS_POR_EIXO)) {
  for (const codigo of codigos) {
    const atuais = eixosPorCodigo.get(codigo) ?? [];
    atuais.push(eixo);
    eixosPorCodigo.set(codigo, atuais);
  }
}

async function metasDoObjetivo(numero: number): Promise<MetaApi[]> {
  const resposta = await fetch(
    `https://odsbrasil.gov.br/objetivo/MetadadosAPIMeta?n=${numero}`
  );
  if (!resposta.ok) {
    throw new Error(`ODS ${numero}: portal respondeu ${resposta.status}`);
  }
  return (await resposta.json()) as MetaApi[];
}

async function main() {
  const metas = await Promise.all(OBJETIVOS.map(([numero]) => metasDoObjetivo(numero)));
  const encontrados = new Set<string>();

  const objetivos = OBJETIVOS.map(([numero, titulo, cor], indice) => {
    const indicadores = metas[indice]
      .flatMap((meta) => meta.indicadores ?? [])
      .filter((indicador) => eixosPorCodigo.has(indicador.numero))
      .map((indicador) => {
        encontrados.add(indicador.numero);
        const n = Number.parseInt(indicador.numero.match(/^\D*(\d+)/)?.[1] ?? "0", 10);
        // Só quem tem ficha publicada ganha link: os demais ficam sem URL no seed.
        const rota = indicador.possui_ficha && indicador.status === "Produzido"
          ? `https://odsbrasil.gov.br/objetivo${n}/indicador${indicador.numero.replaceAll(".", "")}`
          : undefined;

        return {
          codigo: indicador.numero,
          nome: indicador.nome.trim(),
          status: STATUS[indicador.status],
          eixos: eixosPorCodigo.get(indicador.numero),
          ...(rota ? { url: rota } : {}),
        };
      })
      .sort((a, b) => a.codigo.localeCompare(b.codigo, "pt-BR", { numeric: true }));

    return { numero, titulo, cor, indicadores };
  });

  const ausentes = [...eixosPorCodigo.keys()].filter((codigo) => !encontrados.has(codigo));
  if (ausentes.length) {
    throw new Error(`Indicadores mapeados não encontrados no portal: ${ausentes.join(", ")}`);
  }

  const ods5 = objetivos.find((objetivo) => objetivo.numero === 5);
  if (ods5?.indicadores.length !== 14) {
    throw new Error(`ODS 5 incompleto: esperados 14, encontrados ${ods5?.indicadores.length ?? 0}`);
  }

  const saida = {
    consultadoEm: new Date().toISOString().slice(0, 10),
    fontes: FONTES_ODS,
    objetivos,
  };

  const destino = resolve(process.cwd(), "public/data/seed-ods.json");
  await writeFile(destino, `${JSON.stringify(saida, null, 2)}\n`, "utf8");
  const total = objetivos.reduce((soma, objetivo) => soma + objetivo.indicadores.length, 0);
  console.log(`${total} indicadores ODS gravados em ${destino}`);
}

main().catch((erro) => {
  console.error(erro);
  process.exitCode = 1;
});

