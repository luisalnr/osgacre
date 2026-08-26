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
    orgaoSigla: text("orgao_sigla").notNull().default(""),

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

    criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("osg_registros_ano_idx").on(t.ano),
    index("osg_registros_eixo_idx").on(t.eixo),
    index("osg_registros_orgao_idx").on(t.orgaoSigla),
    index("osg_registros_categoria_idx").on(t.categoria),
    index("osg_registros_projeto_idx").on(t.projetoAtividade),
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
export type LeiRow = typeof leis.$inferSelect;
export type LeiInsert = typeof leis.$inferInsert;
export type UsuarioRow = typeof usuarios.$inferSelect;
