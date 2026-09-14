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

/**
 * A nota metodológica em suas quatro ideias, cada uma com o título da pergunta
 * que responde. Vive só no rodapé do painel, abaixo da tabela que ela explica:
 * na página inicial estaria explicando colunas que o leitor ainda não viu.
 */
export const METODOLOGIA_PARTES = [
  {
    titulo: "O que as colunas mostram",
    texto:
      "As colunas do painel são a parcela apropriada ao OSG, não o orçamento da dotação inteira.",
  },
  {
    titulo: "Onde ver a dotação",
    texto:
      "Ao abrir a linha na tabela detalhada aparecem a dotação inicial e a atualizada da ação orçamentária, vindas do Quadro de Detalhamento da Despesa (QDD), e quanto delas foi apropriado ao OSG.",
  },
  {
    titulo: "Como o percentual é calculado",
    texto:
      "O percentual é calculado sobre a dotação inicial da LOA, porque a apropriação do OSG é um número de planejamento; nas emendas parlamentares, que entram na lei com dotação zerada, a base é a dotação atualizada.",
  },
  {
    titulo: "Quando aparece uma anotação",
    texto:
      "Quando o planejado supera a dotação inicial, o percentual dá lugar a uma anotação que informa se a dotação foi suplementada durante o exercício ou se o registro precisa de conferência.",
  },
] as const;

/**
 * Ressalva dos exercícios cuja execução ainda não foi encerrada.
 *
 * Texto único para o painel, o XLSX e o PDF — se cada um escrevesse o seu, três
 * versões da mesma ressalva acabariam dizendo três coisas ligeiramente
 * diferentes sobre o mesmo número.
 *
 * Fica fora de `METODOLOGIA_PARTES` de propósito: aquele bloco descreve a
 * metodologia do OSG e vale para todo exercício, enquanto esta é uma condição
 * temporária de um exercício específico, que sai quando o COSG fechar o ano.
 */
export const NOTA_EM_APURACAO = {
  titulo: "Execução em apuração",
  texto:
    "O valor planejado deste exercício vem da lei orçamentária e está fechado. " +
    "O liquidado, não: é um acumulado parcial do ano em curso e ainda vai subir " +
    "até o encerramento. Por isso ele não é exibido aqui — compará-lo com a " +
    "execução de exercícios já encerrados faria o ano corrente parecer pior do " +
    "que vai terminar.",
} as const;

export type Relatorio = {
  titulo: string;
  descricao: string;
  arquivo: string;
  /**
   * Capa rasterizada da página 1 do PDF, em A4 (1:1.414), gerada por
   * `scripts/capas-relatorios.py`. Opcional de propósito: uma publicação pode
   * entrar aqui antes da capa existir, e o cartão cai no formato sem imagem.
   */
  capa?: string;
  ano: string;
  tipo: "Relatório" | "Guia";
};

export const RELATORIOS: Relatorio[] = [
  {
    titulo: "Relatório OSG 2025",
    descricao:
      "Execução orçamentária de 2024 e previsão para 2025, com análises por categoria, eixo temático, função orçamentária e unidade executora, além do recorte do eixo Segurança.",
    arquivo: "/relatorios/SEPLAN-OSG-2025.pdf",
    capa: "/relatorios/capas/osg-2025.png",
    ano: "2025",
    tipo: "Relatório",
  },
  {
    titulo: "Relatório OSG 2024",
    descricao:
      "Primeiro relatório do Orçamento Sensível ao Gênero do Estado do Acre: consolidação da apuração dos gastos com políticas para as mulheres na Lei Orçamentária de 2024.",
    arquivo: "/relatorios/SEPLAN-OSG-2024.pdf",
    capa: "/relatorios/capas/osg-2024.png",
    ano: "2024",
    tipo: "Relatório",
  },
  {
    titulo: "Guia Orientativo para Implantação do OSG",
    descricao:
      "Fundamentação legal, conceitos, etapas de implantação, matriz de classificação de gastos e indicadores de monitoramento — material de referência para os órgãos executores.",
    arquivo: "/relatorios/SEPLAN-GUIA-OSG.pdf",
    capa: "/relatorios/capas/guia-osg.png",
    ano: "2026",
    tipo: "Guia",
  },
];

/**
 * Composição do DEPPO, o departamento que mantém o painel. Nomes e cargos são
 * informação de crédito — conferir com a chefia antes de alterar.
 */
export const EQUIPE_DEPPO = {
  orgao: "Departamento de Estudos e Planejamento Orçamentário — DEPPO/SEPLAN",
  /** Cabeçalho da coluna do rodapé; o nome por extenso não cabe em uma linha
   *  e já aparece no parágrafo do COSG, ao lado. */
  sigla: "Equipe DEPPO/SEPLAN",
  coordenacao: [
    { nome: "Denyscley Oliveira Bandeira", cargo: "Gestor de Políticas Públicas" },
  ],
  tecnica: [
    { nome: "Ícaro Lebre Gundim", cargo: "Economista" },
    { nome: "Luísa Nascimento Ribeiro", cargo: "Economista" },
    {
      nome: "Roseneide Mendonça de Sena Caldera",
      cargo: "Especialista Executiva – Administração",
    },
    { nome: "Vinicius Carneiro de Farias", cargo: "Economista" },
  ],
} as const;

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
