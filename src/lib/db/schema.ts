import {
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

/**
 * `osg_registros` — uma linha por ENTREGA apropriada, que é a granularidade
 * da planilha Tabela_OSG. Uma mesma dotação (ano + projeto/atividade) pode ter
 * várias entregas, de órgãos diferentes.
 *
 * Órgão e unidade são resolvidos contra o QDD na importação, por
 * `resolverUnidade`, e gravados já canônicos: código e nome de cada um, nunca a
 * string composta da planilha. A Tabela OSG traz os dois fundidos
 * (`"721/302 - FUNDHACRE"`) e o que ela chama de órgão é, em parte das linhas, o
 * executor da entrega — não a unidade onde a dotação está. Sem essa resolução
 * dois exercícios não são comparáveis, porque o mesmo órgão aparece com grafias
 * diferentes em cada planilha.
 *
 * Sobre os valores: `aprop_osg` e `liq_osg` são os números reais da entrega.
 * Os quatro valores da dotação inteira (`orc_aprovado`, `orc_final`,
 * `liq_projeto`, `a_liquidar`) chegam da planilha já RATEADOS pelo número de
 * linhas do grupo (ano, projeto/atividade) — somá-los sobre o grupo inteiro
 * devolve o total do projeto. Como o rateio ignora o órgão, esses totais são
 * pré-calculados na importação e gravados em `orc_aprovado_projeto`,
 * `orc_final_projeto` e `liq_projeto_total`, iguais em todas as linhas do grupo.
 *
 * O denominador do "peso do OSG na dotação" é `orc_aprovado_projeto`: apropriação
 * e orçamento aprovado são ambos números de planejamento, e a razão entre eles
 * reproduz a metodologia (categoria 1 = 100%, categoria 3 = 50%).
 */
export const registros = pgTable(
  "osg_registros",
  {
    id: text("id").primaryKey(),
    ano: integer("ano").notNull(),
    categoria: integer("categoria").notNull(),

    orgaoCodigo: text("orgao_codigo").notNull().default(""),
    orgaoNome: text("orgao_nome").notNull().default(""),
    unidadeCodigo: text("unidade_codigo").notNull().default(""),
    unidadeNome: text("unidade_nome").notNull().default(""),

    aplicacaoProgramada: text("aplicacao_programada").notNull().default(""),
    projetoAtividade: text("projeto_atividade").notNull().default(""),
    funcaoCodigo: text("funcao_codigo").notNull().default(""),
    programaCodigo: text("programa_codigo").notNull().default(""),
    eixo: text("eixo").notNull().default(""),
    entrega: text("entrega").notNull().default(""),

    apropOsg: numeric("aprop_osg", { precision: 16, scale: 2 }).notNull().default("0"),
    liqOsg: numeric("liq_osg", { precision: 16, scale: 2 }).notNull().default("0"),

    orcAprovado: numeric("orc_aprovado", { precision: 16, scale: 2 }).notNull().default("0"),
    orcFinal: numeric("orc_final", { precision: 16, scale: 2 }).notNull().default("0"),
    liqProjeto: numeric("liq_projeto", { precision: 16, scale: 2 }).notNull().default("0"),
    aLiquidar: numeric("a_liquidar", { precision: 16, scale: 2 }).notNull().default("0"),
    orcAprovadoProjeto: numeric("orc_aprovado_projeto", { precision: 16, scale: 2 })
      .notNull()
      .default("0"),
    orcFinalProjeto: numeric("orc_final_projeto", { precision: 16, scale: 2 })
      .notNull()
      .default("0"),
    liqProjetoTotal: numeric("liq_projeto_total", { precision: 16, scale: 2 })
      .notNull()
      .default("0"),

    // --- Campos do Sistema de Orçamentos Temáticos (2026 em diante) ---
    //
    // O relatório novo informa o planejado e o liquidado no nível da DOTAÇÃO, e
    // não da entrega: as três colunas de nível dotação só aparecem na primeira
    // linha de cada grupo do arquivo. Aqui elas são repetidas em todas as linhas
    // do grupo, seguindo o mesmo padrão de `orc_aprovado_projeto` — quem lê uma
    // linha sozinha tem o valor da dotação inteira sem precisar reagrupar.
    //
    // Em 2024/2025 `planejado_dotacao` é preenchido na importação com a soma dos
    // `aprop_osg` do grupo, para que os três exercícios sejam comparáveis pelo
    // mesmo campo.

    /** Orçamento temático de origem. Este painel só exibe `OSG`. */
    tema: text("tema").notNull().default("OSG"),
    /** Ciclo de apuração do sistema: "Ciclo de Validação 2026". */
    ciclo: text("ciclo").notNull().default(""),

    /**
     * Fator de apropriação: 1 na categoria 1, 0,5 na categoria 3.
     *
     * NULO na categoria 2, e é justamente esse o dado: ali a apropriação é
     * discriminada caso a caso pelo órgão executor, não há fator. Gravar 0 no
     * lugar do nulo apagaria a distinção entre "não pondera" e "pondera por zero".
     */
    ponderador: numeric("ponderador", { precision: 5, scale: 4 }),

    /** "Planejado ponderado" — o valor da dotação inteira, já com o ponderador aplicado. */
    planejadoDotacao: numeric("planejado_dotacao", { precision: 16, scale: 2 })
      .notNull()
      .default("0"),
    /**
     * De onde saiu `planejado_dotacao`: `relatorio` ou `dotacao-atualizada`.
     *
     * Emenda parlamentar entra na LOA com dotação inicial zerada por construção,
     * e o Sistema de Orçamentos Temáticos calcula o planejado sobre a inicial —
     * então reporta zero para todas elas. Nesses casos a importação deriva o
     * valor da dotação atualizada do QDD, que é onde a alocação dos planos de
     * trabalho aparece, e marca a linha aqui.
     *
     * Sem esta coluna um valor calculado na importação ficaria indistinguível de
     * um valor apurado pelo COSG, e o painel diria que o relatório informou uma
     * quantia que ele informou como zero.
     */
    planejadoOrigem: text("planejado_origem").notNull().default("relatorio"),
    /**
     * "Planejado da Entrega" — o valor discriminado desta entrega.
     *
     * NULO quando a fonte não discrimina, que é o caso das categorias 1 e 3: lá
     * o valor existe só na dotação. `aprop_osg` recebe o rateio nesses casos, e
     * este campo nulo é o que permite distinguir valor apurado de valor rateado.
     */
    planejadoEntrega: numeric("planejado_entrega", { precision: 16, scale: 2 }),
    /** "Liquidado temático" — nível dotação. Gravado sempre, exibido só com o exercício fechado. */
    liqDotacao: numeric("liq_dotacao", { precision: 16, scale: 2 }).notNull().default("0"),

    /** "Programa funcional": 17 dígitos, função(2)+subfunção(3)+programa(4)+ação(8). */
    funcaoProgramatica: text("funcao_programatica").notNull().default(""),
    entregaDescricao: text("entrega_descricao").notNull().default(""),
    quantidade: numeric("quantidade", { precision: 16, scale: 2 }).notNull().default("0"),
    municipio: text("municipio").notNull().default(""),
    publicoBeneficiado: text("publico_beneficiado").notNull().default(""),

    criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("osg_registros_ano_idx").on(t.ano),
    index("osg_registros_eixo_idx").on(t.eixo),
    index("osg_registros_orgao_idx").on(t.orgaoCodigo, t.unidadeCodigo),
    index("osg_registros_categoria_idx").on(t.categoria),
    index("osg_registros_projeto_idx").on(t.projetoAtividade),
    index("osg_registros_tema_idx").on(t.tema, t.ano),
  ]
);

/**
 * `osg_qdd` — o Quadro de Detalhamento da Despesa do exercício, agregado por
 * (exercício, órgão, unidade, projeto/atividade, fonte, conta de despesa).
 *
 * Guarda o QDD inteiro, não só as dotações que o OSG referencia: são de 6 a 9 mil
 * linhas por exercício e o sistema de Orçamentos Temáticos precisa do conjunto.
 * A granularidade é a do relatório de origem, uma linha por conta de despesa e
 * fonte, porque é dela que saem fonte de recurso, categoria econômica, grupo de
 * natureza, modalidade e elemento. Agregar como antes apagava todas elas.
 *
 * `dotacao_atualizada` é a coluna `Ini+Sup+Cor-Red (B)`. É ela que reflete
 * remanejamentos feitos durante o exercício e a única em que as emendas
 * parlamentares aparecem — elas entram na LOA zeradas e só recebem valor depois
 * da alocação dos planos de trabalho.
 */
export const qdd = pgTable(
  "osg_qdd",
  {
    id: text("id").primaryKey(),
    ano: integer("ano").notNull(),
    orgaoCodigo: text("orgao_codigo").notNull().default(""),
    orgaoNome: text("orgao_nome").notNull().default(""),
    unidadeCodigo: text("unidade_codigo").notNull().default(""),
    unidadeNome: text("unidade_nome").notNull().default(""),
    projetoAtividade: text("projeto_atividade").notNull().default(""),
    aplicacaoProgramada: text("aplicacao_programada").notNull().default(""),
    funcaoProgramatica: text("funcao_programatica").notNull().default(""),
    fonte: text("fonte").notNull().default(""),
    contaDespesa: text("conta_despesa").notNull().default(""),
    descricaoDespesa: text("descricao_despesa").notNull().default(""),

    dotacaoInicial: numeric("dotacao_inicial", { precision: 16, scale: 2 }).notNull().default("0"),
    suplementado: numeric("suplementado", { precision: 16, scale: 2 }).notNull().default("0"),
    dotacaoAtualizada: numeric("dotacao_atualizada", { precision: 16, scale: 2 }).notNull().default("0"),
    empenhado: numeric("empenhado", { precision: 16, scale: 2 }).notNull().default("0"),
    liquidado: numeric("liquidado", { precision: 16, scale: 2 }).notNull().default("0"),
    aLiquidar: numeric("a_liquidar", { precision: 16, scale: 2 }).notNull().default("0"),
    pago: numeric("pago", { precision: 16, scale: 2 }).notNull().default("0"),

    criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("osg_qdd_ano_idx").on(t.ano),
    index("osg_qdd_orgao_projeto_idx").on(t.ano, t.orgaoCodigo, t.projetoAtividade),
    index("osg_qdd_projeto_idx").on(t.ano, t.projetoAtividade),
    index("osg_qdd_fonte_idx").on(t.ano, t.fonte),
  ]
);

/**
 * `osg_leis` — instrumentos legais que embasam o OSG, vindos das seis abas do
 * "HISTÓRICO DE LEIS ORÇAMENTO SENSÍVEL AO GÊNERO.xlsx". `url` é o link do
 * legis.ac.gov.br embutido na célula da planilha (nem toda linha tem).
 */
export const leis = pgTable(
  "osg_leis",
  {
    id: text("id").primaryKey(),
    tipo: text("tipo").notNull(),
    ordem: integer("ordem").notNull().default(0),
    numero: text("numero").notNull().default(""),
    data: text("data").notNull().default(""),
    doe: text("doe").notNull().default(""),
    ementa: text("ementa").notNull().default(""),
    orgao: text("orgao").notNull().default(""),
    url: text("url").notNull().default(""),
    sensivelGenero: text("sensivel_genero").notNull().default(""),
    citacoes: text("citacoes").notNull().default(""),
    metas: text("metas").notNull().default(""),
    criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("osg_leis_tipo_idx").on(t.tipo)]
);

/** `osg_usuarios` — acesso ao /admin. Senha em scrypt, formato `salt:hash`. */
export const usuarios = pgTable("osg_usuarios", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  nome: text("nome").notNull().default(""),
  senhaHash: text("senha_hash").notNull(),
  papel: text("papel").notNull().default("admin"),
  criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
});

export type RegistroRow = typeof registros.$inferSelect;
export type RegistroInsert = typeof registros.$inferInsert;
export type QddRow = typeof qdd.$inferSelect;
export type QddInsert = typeof qdd.$inferInsert;
export type LeiRow = typeof leis.$inferSelect;
export type LeiInsert = typeof leis.$inferInsert;
export type UsuarioRow = typeof usuarios.$inferSelect;
