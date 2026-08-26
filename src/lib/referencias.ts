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
  regra: string;
  descricao: string;
};

export const CATEGORIAS: Categoria[] = [
  {
    numero: 1,
    titulo: "Dotações exclusivas",
    regra: "100% do valor",
    descricao:
      "Dotações cujas entregas se destinam exclusivamente às mulheres. Como todo o gasto é direcionado ao público-alvo, a apropriação no OSG é integral.",
  },
  {
    numero: 2,
    titulo: "Dotações com entrega estratégica",
    regra: "Discriminada pelo órgão",
    descricao:
      "Dotações genéricas, não exclusivas, que contêm entregas estratégicas para as mulheres previstas no PPA ou em outro instrumento de planejamento. O próprio órgão executor discrimina quanto do valor foi apropriado.",
  },
  {
    numero: 3,
    titulo: "Dotações de público misto",
    regra: "50% do valor",
    descricao:
      "Dotações genéricas com entregas para mulheres em conjunto com outros grupos, sem previsão explícita. Apropria-se metade do valor, proporção equivalente à participação das mulheres na população.",
  },
];

export const CATEGORIA_POR_NUMERO = new Map(CATEGORIAS.map((c) => [c.numero, c]));

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
 * Programas do PPA 2024-2027 citados nas dotações do OSG.
 * A planilha traz só o código; os nomes conhecidos vêm da LDO. Acrescente aqui
 * conforme forem confirmados — o painel mostra o código quando o nome falta.
 */
export const PROGRAMAS: Record<string, string> = {
  "1446": "Desenvolvimento da Produção Familiar, Bioeconomia e Agronegócio",
  "1454": "Integração da Comunidade e Segurança Pública",
  "1461": "Mulher, Transversalidade e Força",
};

/** Remove acentos e baixa a caixa — base de toda a normalização de rótulos. */
export function chave(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

const EIXO_POR_CHAVE = new Map<string, EixoSlug>();
for (const e of EIXOS) {
  EIXO_POR_CHAVE.set(chave(e.nome), e.slug);
  EIXO_POR_CHAVE.set(e.slug, e.slug);
}
// Variações que aparecem na planilha.
EIXO_POR_CHAVE.set("assistencia social e direitos humanos", "assistencia-social");
EIXO_POR_CHAVE.set("assistencia social", "assistencia-social");
EIXO_POR_CHAVE.set("seguranca publica", "seguranca");
EIXO_POR_CHAVE.set("desenvolvimento economico", "economico");

/** Converte o rótulo do eixo vindo da planilha no slug canônico. `null` se não reconhecer. */
export function normalizarEixo(bruto: string): EixoSlug | null {
  return EIXO_POR_CHAVE.get(chave(bruto)) ?? null;
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
  return PROGRAMAS[c] ? `${c} — ${PROGRAMAS[c]}` : c;
}
