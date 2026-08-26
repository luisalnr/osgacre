/**
 * Textos institucionais da página. Ficam aqui, e não espalhados no JSX, para
 * facilitar a revisão pela SEPLAN e pela SEMULHER.
 *
 * Fontes: Lei nº 4.168/2023, Guia Orientativo para Implantação do OSG e
 * Relatórios OSG 2024 e 2025.
 */

export const NAVEGACAO = [
  { rotulo: "Sobre", href: "/#sobre" },
  { rotulo: "Eixos", href: "/#eixos" },
  { rotulo: "Base legal", href: "/#base-legal" },
  { rotulo: "Relatórios", href: "/#relatorios" },
] as const;

export const HERO = {
  chapeu: "Orçamentos temáticos do Acre",
  titulo: "Orçamento Sensível ao Gênero",
  subtitulo:
    "Acompanhamento das dotações do Estado do Acre com entregas destinadas às mulheres, instituído pela Lei nº 4.168, de 6 de setembro de 2023.",
};

export const SOBRE = {
  titulo: "O que é o Orçamento Sensível ao Gênero?",
  paragrafos: [
    "O Orçamento Sensível ao Gênero (OSG) é uma metodologia de planejamento e execução orçamentária que incorpora a perspectiva de gênero para garantir equidade na alocação de recursos e na implementação das políticas públicas.",
    "O Acre instituiu o OSG pela Lei nº 4.168, de 6 de setembro de 2023, e a apuração é coordenada pelo Comitê de Apuração do Orçamento Sensível ao Gênero (COSG), criado pelo Decreto nº 11.394, de 5 de janeiro de 2024, que reúne a Vice-Governadoria, a Secretaria de Estado da Mulher, a Secretaria de Estado de Planejamento e outros órgãos estratégicos.",
  ],
  naoE: [
    "Não é um orçamento separado para mulheres.",
    "Não implica aumento automático de gastos.",
    "Torna visível o impacto diferenciado das políticas sobre mulheres e homens.",
  ],
  comoApura:
    "Cada dotação do orçamento estadual é triada por palavras-chave, discutida com o órgão executor e enquadrada em uma das três categorias abaixo. A categoria define quanto do valor da dotação é apropriado ao OSG.",
};

export const METODOLOGIA_NOTA =
  "As colunas do orçamento da dotação inteira (aprovado, atualizado e liquidado do projeto/atividade) não são exibidas no painel: o que se acompanha aqui é a parcela apropriada ao OSG. O percentual de participação em cada dotação aparece ao abrir a linha na tabela detalhada.";

export type Relatorio = {
  titulo: string;
  descricao: string;
  arquivo: string;
  ano: string;
  tipo: "Relatório" | "Guia";
};

export const RELATORIOS: Relatorio[] = [
  {
    titulo: "Relatório OSG 2025",
    descricao:
      "Execução orçamentária de 2024 e previsão para 2025, com análises por categoria, eixo temático, função orçamentária e unidade executora, além do recorte do eixo Segurança.",
    arquivo: "/relatorios/SEPLAN-OSG-2025.pdf",
    ano: "2025",
    tipo: "Relatório",
  },
  {
    titulo: "Relatório OSG 2024",
    descricao:
      "Primeiro relatório do Orçamento Sensível ao Gênero do Estado do Acre: consolidação da apuração dos gastos com políticas para as mulheres na Lei Orçamentária de 2024.",
    arquivo: "/relatorios/SEPLAN-OSG-2024.pdf",
    ano: "2024",
    tipo: "Relatório",
  },
  {
    titulo: "Guia Orientativo para Implantação do OSG",
    descricao:
      "Fundamentação legal, conceitos, etapas de implantação, matriz de classificação de gastos e indicadores de monitoramento — material de referência para os órgãos executores.",
    arquivo: "/relatorios/SEPLAN-GUIA-OSG.pdf",
    ano: "2026",
    tipo: "Guia",
  },
];

export const LINKS_INSTITUCIONAIS = [
  { rotulo: "SEPLAN Acre", href: "https://seplan.ac.gov.br/" },
  {
    rotulo: "Relatório OSG no site da SEPLAN",
    href: "https://seplan.ac.gov.br/planejamento-governamental/orcamentos-tematicos/relatorio-orcamento-sensivel-ao-genero-osg/",
  },
  { rotulo: "Secretaria de Estado da Mulher", href: "https://semulher.ac.gov.br/" },
  { rotulo: "Legislação do Estado do Acre", href: "https://legis.ac.gov.br/" },
  { rotulo: "Diário Oficial do Estado", href: "https://diario.ac.gov.br/" },
];

export const OUTROS_ORCAMENTOS = [
  {
    rotulo: "Orçamento Criança e Adolescente",
    sigla: "OCAD",
    href: "https://ocadac.vercel.app/",
  },
  {
    rotulo: "Orçamento Climático",
    sigla: "ORCLIMA",
    href: "https://orclima.vercel.app/",
  },
];
