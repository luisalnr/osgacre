import {
  EIXO_PPA_POR_PROGRAMA,
  FONTES,
  PROGRAMAS_TEMATICOS,
  SUBFUNCOES,
} from "./tabelas";

/**
 * Tabelas de referência do OSG.
 *
 * Fontes:
 *  - Eixos e funções: Lei Estadual nº 4.168, de 06/09/2023 (art. 4º), transcrita
 *    no Relatório OSG 2025.
 *  - Categorias: Guia Orientativo para Implantação do OSG, seção 4.4.
 *  - Funções orçamentárias: Portaria MOG nº 42/1999, conforme o MTO/STN.
 */

export type EixoSlug =
  | "assistencia-social"
  | "educacao"
  | "saude"
  | "seguranca"
  | "economico"
  | "governanca";

export type Eixo = {
  slug: EixoSlug;
  romano: string;
  nome: string;
  /** Rótulo curto para eixos de gráfico, onde o nome completo não cabe. */
  curto: string;
  /** Funções que a lei associa ao eixo. */
  funcoes: string[];
  /** Códigos de função orçamentária que costumam cair neste eixo. */
  descricao: string;
};

export const EIXOS: Eixo[] = [
  {
    slug: "assistencia-social",
    romano: "I",
    nome: "Assistência Social e Direitos Humanos",
    curto: "I · Assist. Social",
    funcoes: ["assistência social", "direitos da cidadania"],
    descricao:
      "Proteção social, acolhimento e garantia de direitos — inclui a rede de enfrentamento à violência doméstica e as políticas de autonomia das mulheres.",
  },
  {
    slug: "educacao",
    romano: "II",
    nome: "Educação",
    curto: "II · Educação",
    funcoes: ["educação", "cultura", "desporto", "lazer"],
    descricao:
      "Permanência e desempenho escolar de meninas e mulheres, formação técnica e superior, pesquisa, cultura, esporte e lazer.",
  },
  {
    slug: "saude",
    romano: "III",
    nome: "Saúde",
    curto: "III · Saúde",
    funcoes: ["saúde", "habitação", "saneamento"],
    descricao:
      "Saúde da mulher em todo o ciclo de vida — atenção materno-infantil, saúde sexual e reprodutiva — além de moradia e saneamento.",
  },
  {
    slug: "seguranca",
    romano: "IV",
    nome: "Segurança",
    curto: "IV · Segurança",
    funcoes: ["prevenção", "policiamento", "informação", "inteligência"],
    descricao:
      "Prevenção e resposta à violência de gênero: Patrulha Maria da Penha, delegacias especializadas, inteligência e capacitação das forças de segurança.",
  },
  {
    slug: "economico",
    romano: "V",
    nome: "Econômico",
    curto: "V · Econômico",
    funcoes: [
      "relações de trabalho",
      "empregabilidade",
      "fomento ao trabalho",
      "proteção",
      "benefícios ao trabalhador",
    ],
    descricao:
      "Autonomia econômica: geração de renda, empreendedorismo, qualificação profissional e acesso ao mercado de trabalho.",
  },
  {
    slug: "governanca",
    romano: "VI",
    nome: "Governança",
    curto: "VI · Governança",
    funcoes: ["participação", "liderança social"],
    descricao:
      "Participação social e ocupação de espaços de decisão — conselhos, conferências e fortalecimento institucional da política de gênero.",
  },
];

export const EIXO_POR_SLUG = new Map(EIXOS.map((e) => [e.slug, e]));

export type Categoria = {
  numero: 1 | 2 | 3;
  titulo: string;
  /** Forma curta, para rótulo de gráfico. */
  regra: string;
  /** Forma por extenso, para o texto explicativo da seção "Sobre". */
  apropriacao: string;
  descricao: string;
};

export const CATEGORIAS: Categoria[] = [
  {
    numero: 1,
    titulo: "Dotações exclusivas",
    regra: "100% do valor",
    apropriacao: "100% do valor aprovado na LOA",
    descricao:
      "Dotações cujas entregas se destinam exclusivamente às mulheres. Como todo o gasto é direcionado ao público-alvo, a apropriação no OSG é integral.",
  },
  {
    numero: 2,
    titulo: "Dotações com entrega estratégica",
    regra: "Discriminada pelo órgão",
    apropriacao: "Discriminada pelo órgão",
    descricao:
      "Dotações genéricas, não exclusivas, que contêm entregas estratégicas para as mulheres previstas no PPA ou em outro instrumento de planejamento. O próprio órgão executor discrimina quanto do valor foi apropriado.",
  },
  {
    numero: 3,
    titulo: "Dotações de público misto",
    regra: "50% do valor",
    apropriacao: "50% do valor aprovado na LOA",
    descricao:
      "Dotações genéricas com entregas para mulheres em conjunto com outros grupos, sem previsão explícita. Apropria-se metade do valor, proporção equivalente à participação das mulheres na população.",
  },
];

export const CATEGORIA_POR_NUMERO = new Map(CATEGORIAS.map((c) => [c.numero, c]));

/**
 * Fator de apropriação da categoria: 1 na 1, 0,5 na 3, `null` na 2.
 *
 * O nulo da categoria 2 é o dado, não a ausência dele — ali quem discrimina o
 * valor é o órgão executor, caso a caso, e não existe fator.
 *
 * O relatório do Sistema de Orçamentos Temáticos informa o ponderador numa
 * coluna própria, e nas 169 linhas de 2026 ele concorda com esta regra sem
 * exceção. Isto aqui é o recuo para 2024/2025, cuja planilha não tinha a coluna,
 * e a referência contra a qual a importação confere o que a fonte manda: se um
 * dia divergirem, o certo é ver o aviso, não escolher em silêncio.
 *
 * Confirmado contra o QDD 2026: `planejado ÷ dotação inicial` dá exatamente
 * 0,500 nas 53 dotações da categoria 3 e 1,000 nas 14 da categoria 1 que não são
 * emenda parlamentar. O valor da planilha já chega ponderado.
 */
export function ponderadorDe(categoria: number): number | null {
  if (categoria === 1) return 1;
  if (categoria === 3) return 0.5;
  return null;
}

/**
 * Exercícios cuja execução ainda não foi encerrada.
 *
 * O painel esconde liquidado e execução destes exercícios: o planejado é da LOA
 * e está fechado, mas o liquidado é um acumulado parcial do ano corrente. Exibir
 * os 68% de 2026 ao lado dos 67,0% de 2024 e dos 63,5% de 2025 — que são anos
 * fechados — compararia coisas diferentes e faria a execução do exercício
 * corrente parecer pior do que vai terminar.
 *
 * É uma lista explícita, e não uma dedução a partir do ano corrente ou do ciclo
 * informado no arquivo, por dois motivos: quem declara um exercício encerrado é
 * o COSG, não o calendário; e um painel publicado que muda sozinho na virada do
 * ano muda sem ninguém ter decidido. Encerrado o exercício, apaga-se a linha.
 */
export const EXERCICIOS_EM_APURACAO: readonly number[] = [2026];

export const emApuracao = (ano: number | null | undefined): boolean =>
  ano !== null && ano !== undefined && EXERCICIOS_EM_APURACAO.includes(ano);

/** Funções orçamentárias — Portaria MOG nº 42/1999 (MTO/STN). */
export const FUNCOES: Record<string, string> = {
  "01": "Legislativa",
  "02": "Judiciária",
  "03": "Essencial à Justiça",
  "04": "Administração",
  "05": "Defesa Nacional",
  "06": "Segurança Pública",
  "07": "Relações Exteriores",
  "08": "Assistência Social",
  "09": "Previdência Social",
  "10": "Saúde",
  "11": "Trabalho",
  "12": "Educação",
  "13": "Cultura",
  "14": "Direitos da Cidadania",
  "15": "Urbanismo",
  "16": "Habitação",
  "17": "Saneamento",
  "18": "Gestão Ambiental",
  "19": "Ciência e Tecnologia",
  "20": "Agricultura",
  "21": "Organização Agrária",
  "22": "Indústria",
  "23": "Comércio e Serviços",
  "24": "Comunicações",
  "25": "Energia",
  "26": "Transporte",
  "27": "Desporto e Lazer",
  "28": "Encargos Especiais",
  "99": "Reserva de Contingência",
};

/**
 * Programas que o OSG cita e o `TABELAS.xlsx` não tem.
 *
 * É complemento de `PROGRAMAS_TEMATICOS`, consultado antes dele. As três
 * entradas que moravam aqui saíram quando a tabela oficial entrou: as três já
 * estão lá, e mantê-las deixaria três programas em Title Case ao lado de outros
 * 53 em caixa alta, como se fossem de origens diferentes — que é justamente o
 * que a tabela oficial veio resolver.
 *
 * Está vazio, e é um bom sinal: hoje todos os 26 programas citados pelas dotações
 * do OSG existem no `TABELAS.xlsx`. O único que faltava era o 4431, que acabou
 * sendo erro de digitação de 1443 e virou correção em `CORRECOES_OSG`
 * (`parser-osg.ts`) — código inexistente no PPA não é lacuna de tabela, é dado
 * errado, e o lugar de tratar isso é na leitura da planilha.
 *
 * Continua aqui para o caso de o OSG citar um programa legítimo que a planilha
 * oficial ainda não trouxe.
 */
export const PROGRAMAS: Record<string, string> = {};

/**
 * Links de reserva para instrumentos cuja célula B, na planilha de origem, ficou
 * sem hyperlink.
 *
 * É **reserva, não substituição**: `parser-leis.ts` só consulta este mapa quando a
 * planilha não trouxe link nenhum. Acrescentar o hyperlink na planilha faz a entrada
 * daqui virar inofensiva, sem precisar removê-la.
 *
 * Cada URL foi localizada pela busca do portal (`POST legis.ac.gov.br/principal`,
 * campos `tipo_lei` e `numero`) e **conferida abrindo a página**, comparando número e
 * data com o cabeçalho oficial em caixa alta. A conferência importa: busca genérica
 * devolve normas que apenas *alteram* ou *citam* a procurada, com aparência de acerto.
 * Um link errado é pior que link nenhum.
 *
 * A chave é `tipo + numero + data`, nunca o `id` — o `id` embute o índice da linha na
 * planilha e muda quando se insere uma linha acima.
 */
export const LINKS_LEIS_SEM_HYPERLINK: {
  tipo: string;
  numero: string;
  data: string;
  url: string;
  cabecalhoConferido: string;
}[] = [
  {
    tipo: "decreto",
    numero: "Decreto nº 11.778",
    data: "24/10/2025",
    url: "https://legis.ac.gov.br/detalhar/6590",
    cabecalhoConferido: "DECRETO Nº 11.778, DE 24 DE OUTUBRO DE 2025",
  },
  {
    tipo: "estrutura",
    numero: "Lei Complementar nº 419",
    data: "15/12/2022",
    url: "https://legis.ac.gov.br/detalhar/5365",
    cabecalhoConferido: "LEI COMPLEMENTAR Nº 419, DE 15 DE DEZEMBRO DE 2022",
  },
  {
    tipo: "ppa",
    numero: "Lei nº 4.282",
    data: "27/12/2023",
    url: "https://legis.ac.gov.br/detalhar/5972",
    cabecalhoConferido: "LEI Nº 4.282, DE 27 DE DEZEMBRO DE 2023",
  },
  {
    tipo: "ldo",
    numero: "Lei nº 4.627",
    data: "31/07/2025",
    url: "https://legis.ac.gov.br/detalhar/6528",
    cabecalhoConferido: "LEI Nº 4.627, DE 31 DE JULHO DE 2025",
  },
  {
    tipo: "loa",
    numero: "Lei nº 4.753",
    data: "31/12/2025",
    url: "https://legis.ac.gov.br/detalhar/6698",
    cabecalhoConferido: "LEI Nº 4.753, DE 31 DE DEZEMBRO DE 2025",
  },
];

/** Chave do mapa de reserva: tipo + número + data, sem acento e sem caixa. */
export function chaveLeiSemLink(
  tipo: string,
  numero: string,
  data: string
): string {
  return [chave(tipo), chave(numero), chave(data)].join("|");
}

export const LINK_RESERVA_POR_LEI = new Map(
  LINKS_LEIS_SEM_HYPERLINK.map((l) => [
    chaveLeiSemLink(l.tipo, l.numero, l.data),
    l.url,
  ])
);

/** Remove acentos e baixa a caixa — base de toda a normalização de rótulos. */
export function chave(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Chave de comparação de eixo: como `chave`, mas tratando `_` e `-` como espaço.
 *
 * É separada do `chave` de propósito. O Sistema de Orçamentos Temáticos escreve
 * os eixos em caixa alta com underscore (`ASSISTENCIA_SOCIAL_DIREITOS_HUMANOS`),
 * enquanto a planilha antiga os escrevia por extenso — os dois têm de cair no
 * mesmo slug, senão 2026 aparece como um eixo à parte nos filtros e nos gráficos
 * e os exercícios deixam de ser comparáveis. Mas `chave` também alimenta a busca
 * do painel e as chaves de lei, onde dobrar separador mudaria comportamento sem
 * relação nenhuma com eixo.
 */
const chaveEixo = (bruto: string): string =>
  chave(bruto).replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();

const EIXO_POR_CHAVE = new Map<string, EixoSlug>();
for (const e of EIXOS) {
  EIXO_POR_CHAVE.set(chaveEixo(e.nome), e.slug);
  EIXO_POR_CHAVE.set(chaveEixo(e.slug), e.slug);
}
// Variações que aparecem na planilha.
EIXO_POR_CHAVE.set("assistencia social e direitos humanos", "assistencia-social");
EIXO_POR_CHAVE.set("assistencia social", "assistencia-social");
EIXO_POR_CHAVE.set("seguranca publica", "seguranca");
EIXO_POR_CHAVE.set("desenvolvimento economico", "economico");
// O rótulo do Sistema de Orçamentos Temáticos não tem o "e" do nome por extenso.
EIXO_POR_CHAVE.set("assistencia social direitos humanos", "assistencia-social");

/** Converte o rótulo do eixo vindo da planilha no slug canônico. `null` se não reconhecer. */
export function normalizarEixo(bruto: string): EixoSlug | null {
  return EIXO_POR_CHAVE.get(chaveEixo(bruto)) ?? null;
}

export function nomeEixo(slug: string): string {
  return EIXO_POR_SLUG.get(slug as EixoSlug)?.nome ?? slug;
}

/** Códigos de função vêm como "6" ou "06"; o canônico tem dois dígitos. */
export function normalizarFuncao(bruto: string | number): string {
  const digitos = String(bruto).replace(/\D/g, "");
  if (!digitos) return "";
  return digitos.padStart(2, "0").slice(-2);
}

export function nomeFuncao(codigo: string): string {
  const c = normalizarFuncao(codigo);
  return FUNCOES[c] ? `${c} — ${FUNCOES[c]}` : c;
}

export function nomePrograma(codigo: string): string {
  const c = String(codigo).trim();
  const nome = PROGRAMAS[c] ?? PROGRAMAS_TEMATICOS[c];
  return nome ? `${c} — ${nome}` : c;
}

/**
 * Eixo temático do PPA a que o programa pertence.
 *
 * **Não confundir com `nomeEixo`.** Aquele é o eixo do OSG — os seis do art. 4º
 * da Lei estadual nº 4.168/2023, que dão as cores e os gráficos do painel. Este
 * é outra classificação, do PPA estadual, que por acaso se chama igual. Os dois
 * só convivem na planilha de exportação, em colunas com rótulos que os separam;
 * na tela, "eixo" quer dizer o do OSG e mais nada.
 *
 * Devolve string vazia quando não conhece o programa, para a coluna sair em
 * branco em vez de repetir o código sem significado.
 */
export function eixoPpa(programaCodigo: string): string {
  return EIXO_PPA_POR_PROGRAMA[String(programaCodigo).trim()] ?? "";
}

/**
 * Fatias posicionais dos dois códigos compostos do QDD.
 *
 * `funcaoProgramatica` tem 17 dígitos: função(2) + subfunção(3) + programa(4) +
 * projeto/atividade(8), e só a subfunção precisa ser extraída daqui — função e
 * programa já vêm em campos próprios do `Registro`. `contaDespesa` tem 10:
 * categoria econômica(1) + grupo de natureza(1) + modalidade(2) + elemento(2) +
 * subelemento(4).
 *
 * São derivações, e não colunas do banco, de propósito: campos guardados ao lado
 * do código de origem podem divergir dele; funções puras, não.
 */
export const subfuncaoDe = (funcaoProgramatica: string) =>
  String(funcaoProgramatica ?? "").slice(2, 5);

export const catEconomicaDe = (contaDespesa: string) =>
  String(contaDespesa ?? "").slice(0, 1);
export const gndDe = (contaDespesa: string) => String(contaDespesa ?? "").slice(1, 2);
export const modalidadeDe = (contaDespesa: string) =>
  String(contaDespesa ?? "").slice(2, 4);
export const elementoDe = (contaDespesa: string) =>
  String(contaDespesa ?? "").slice(4, 6);

/**
 * Fábrica dos rótulos "código — descrição".
 *
 * Seis classificações têm exatamente a mesma regra de exibição, e a de `função`
 * já existia antes desta fábrica: acerto vira `"06 — Segurança Pública"`, erro
 * devolve o código nu, porque um código sem nome ainda informa e um traço
 * sozinho não. `normalizar` acerta o comprimento do código quando a origem varia
 * (o QDD escreve "6" onde a tabela tem "06").
 */
function rotulador(
  tabela: Record<string, string>,
  normalizar: (bruto: string) => string = (b) => b.trim()
) {
  return (codigo: string | number): string => {
    const c = normalizar(String(codigo ?? ""));
    if (!c) return "";
    return tabela[c] ? `${c} — ${tabela[c]}` : c;
  };
}

const digitos = (n: number) => (bruto: string) => {
  const d = bruto.replace(/\D/g, "");
  return d ? d.padStart(n, "0").slice(-n) : "";
};

/**
 * Irmão de `rotulador` que devolve só a DESCRIÇÃO, sem o código na frente.
 *
 * Existe para a planilha de exportação, onde código e descrição ocupam colunas
 * separadas: `"06"` numa, `"Segurança Pública"` na outra. É o que permite
 * dinamizar por código e cruzar com outra base sem antes fatiar a string.
 *
 * Devolve vazio, e não o código, quando a tabela não conhece o código: ali a
 * coluna ao lado já mostra o código, e repeti-lo na coluna de nome faria a
 * planilha parecer ter um nome que ninguém tem.
 */
function descritor(
  tabela: Record<string, string>,
  normalizar: (bruto: string) => string = (b) => b.trim()
) {
  return (codigo: string | number): string =>
    tabela[normalizar(String(codigo ?? ""))] ?? "";
}

export const nomeSubfuncao = rotulador(SUBFUNCOES, digitos(3));
export const descricaoSubfuncao = descritor(SUBFUNCOES, digitos(3));

export const descricaoFuncao = descritor(FUNCOES, normalizarFuncao);

/** Programa mora em duas tabelas: as do PPA e as temáticas. */
export function descricaoPrograma(codigo: string | number): string {
  const c = String(codigo ?? "").trim();
  return PROGRAMAS[c] ?? PROGRAMAS_TEMATICOS[c] ?? "";
}

/**
 * Fonte de recurso — **sem normalizar o comprimento**, ao contrário das demais.
 *
 * O padrão da Portaria STN nº 710/2021 tem oito dígitos, mas o QDD traz códigos
 * de sete que parecem truncados na origem (1500100, 1546000) e um "0" solitário.
 * Completar com zero à esquerda transformaria cada um deles em outro código, que
 * existe e significa outra coisa. Melhor exibir o código estranho como ele é.
 */
export const nomeFonte = rotulador(FONTES);
export const descricaoFonte = descritor(FONTES);
