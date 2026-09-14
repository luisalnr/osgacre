import { limparNome } from "../orgaos";
import { ponderadorDe } from "../referencias";
import type { DotacaoQdd, Lei, Registro, TipoLei } from "../types";
import type {
  LeiInsert,
  LeiRow,
  QddInsert,
  QddRow,
  RegistroInsert,
  RegistroRow,
} from "./schema";

/** Postgres devolve `numeric` como string para não perder precisão. */
const num = (v: string | number | null | undefined): number => {
  const n = typeof v === "number" ? v : Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

/** Duas casas, para não gravar dízimas do ponto flutuante no banco. */
const dec = (v: number): string => (Number.isFinite(v) ? v : 0).toFixed(2);

/**
 * Como `num`/`dec`, mas preservando o nulo.
 *
 * `ponderador` e `planejado_entrega` são nulos por significado — "não pondera" e
 * "não discriminado" —, e passá-los pelo `num()` os transformaria em zero, que
 * quer dizer outra coisa: apropriação nula. São os únicos dois campos numéricos
 * da tabela em que a distinção existe.
 */
const numOuNulo = (v: string | number | null | undefined): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};

const decOuNulo = (v: number | null | undefined): string | null =>
  v === null || v === undefined || !Number.isFinite(v) ? null : v.toFixed(2);

export function rowToRegistro(row: RegistroRow): Registro {
  return {
    id: row.id,
    ano: row.ano,
    categoria: row.categoria,
    orgaoCodigo: row.orgaoCodigo,
    // `limparNome` na leitura, e não só na importação: as linhas gravadas antes
    // de a limpeza existir continuam no banco com o nome como o QDD o escreveu,
    // e sem isto o painel e os relatórios mostrariam duas grafias do mesmo órgão
    // conforme a data da carga. Normalizar aqui faz a correção valer na hora,
    // sem depender de reimportar o QDD. São 185 linhas, custo irrelevante.
    orgaoNome: limparNome(row.orgaoNome),
    unidadeCodigo: row.unidadeCodigo,
    unidadeNome: limparNome(row.unidadeNome),
    aplicacaoProgramada: row.aplicacaoProgramada,
    projetoAtividade: row.projetoAtividade,
    funcaoCodigo: row.funcaoCodigo,
    programaCodigo: row.programaCodigo,
    eixo: row.eixo,
    entrega: row.entrega,
    apropOsg: num(row.apropOsg),
    liqOsg: num(row.liqOsg),
    orcAprovado: num(row.orcAprovado),
    orcFinal: num(row.orcFinal),
    liqProjeto: num(row.liqProjeto),
    aLiquidar: num(row.aLiquidar),
    orcAprovadoProjeto: num(row.orcAprovadoProjeto),
    orcFinalProjeto: num(row.orcFinalProjeto),
    liqProjetoTotal: num(row.liqProjetoTotal),
    tema: row.tema,
    ciclo: row.ciclo,
    // O ponderador é derivável da categoria e a fonte o informa explicitamente.
    // Grava-se o que a fonte diz; o `ponderadorDe` entra como recuo para as
    // linhas de 2024/2025, que vêm de uma planilha sem a coluna. A importação
    // avisa quando os dois discordam, que é o caso em que a metodologia mudou.
    ponderador: numOuNulo(row.ponderador) ?? ponderadorDe(row.categoria),
    planejadoDotacao: num(row.planejadoDotacao),
    planejadoOrigem:
      row.planejadoOrigem === "dotacao-atualizada" ? "dotacao-atualizada" : "relatorio",
    planejadoEntrega: numOuNulo(row.planejadoEntrega),
    liqDotacao: num(row.liqDotacao),
    funcaoProgramatica: row.funcaoProgramatica,
    entregaDescricao: row.entregaDescricao,
    quantidade: num(row.quantidade),
    municipio: row.municipio,
    publicoBeneficiado: row.publicoBeneficiado,
  };
}

export function registroToInsert(r: Registro): RegistroInsert {
  return {
    id: r.id,
    ano: r.ano,
    categoria: r.categoria,
    orgaoCodigo: r.orgaoCodigo,
    orgaoNome: r.orgaoNome,
    unidadeCodigo: r.unidadeCodigo,
    unidadeNome: r.unidadeNome,
    aplicacaoProgramada: r.aplicacaoProgramada,
    projetoAtividade: r.projetoAtividade,
    funcaoCodigo: r.funcaoCodigo,
    programaCodigo: r.programaCodigo,
    eixo: r.eixo,
    entrega: r.entrega,
    apropOsg: dec(r.apropOsg),
    liqOsg: dec(r.liqOsg),
    orcAprovado: dec(r.orcAprovado),
    orcFinal: dec(r.orcFinal),
    liqProjeto: dec(r.liqProjeto),
    aLiquidar: dec(r.aLiquidar),
    orcAprovadoProjeto: dec(r.orcAprovadoProjeto),
    orcFinalProjeto: dec(r.orcFinalProjeto),
    liqProjetoTotal: dec(r.liqProjetoTotal),
    tema: r.tema,
    ciclo: r.ciclo,
    ponderador: decOuNulo(r.ponderador),
    planejadoDotacao: dec(r.planejadoDotacao),
    planejadoOrigem: r.planejadoOrigem,
    planejadoEntrega: decOuNulo(r.planejadoEntrega),
    liqDotacao: dec(r.liqDotacao),
    funcaoProgramatica: r.funcaoProgramatica,
    entregaDescricao: r.entregaDescricao,
    quantidade: dec(r.quantidade),
    municipio: r.municipio,
    publicoBeneficiado: r.publicoBeneficiado,
  };
}

export const registrosToInserts = (rs: Registro[]) => rs.map(registroToInsert);

export function rowToQdd(row: QddRow): DotacaoQdd {
  return {
    id: row.id,
    ano: row.ano,
    orgaoCodigo: row.orgaoCodigo,
    // `limparNome` na leitura, e não só na importação: as linhas gravadas antes
    // de a limpeza existir continuam no banco com o nome como o QDD o escreveu,
    // e sem isto o painel e os relatórios mostrariam duas grafias do mesmo órgão
    // conforme a data da carga. Normalizar aqui faz a correção valer na hora,
    // sem depender de reimportar o QDD. São 185 linhas, custo irrelevante.
    orgaoNome: limparNome(row.orgaoNome),
    unidadeCodigo: row.unidadeCodigo,
    unidadeNome: limparNome(row.unidadeNome),
    projetoAtividade: row.projetoAtividade,
    aplicacaoProgramada: row.aplicacaoProgramada,
    funcaoProgramatica: row.funcaoProgramatica,
    fonte: row.fonte,
    contaDespesa: row.contaDespesa,
    descricaoDespesa: row.descricaoDespesa,
    dotacaoInicial: num(row.dotacaoInicial),
    suplementado: num(row.suplementado),
    dotacaoAtualizada: num(row.dotacaoAtualizada),
    empenhado: num(row.empenhado),
    liquidado: num(row.liquidado),
    aLiquidar: num(row.aLiquidar),
    pago: num(row.pago),
  };
}

export function qddToInsert(d: DotacaoQdd): QddInsert {
  return {
    id: d.id,
    ano: d.ano,
    orgaoCodigo: d.orgaoCodigo,
    orgaoNome: d.orgaoNome,
    unidadeCodigo: d.unidadeCodigo,
    unidadeNome: d.unidadeNome,
    projetoAtividade: d.projetoAtividade,
    aplicacaoProgramada: d.aplicacaoProgramada,
    funcaoProgramatica: d.funcaoProgramatica,
    fonte: d.fonte,
    contaDespesa: d.contaDespesa,
    descricaoDespesa: d.descricaoDespesa,
    dotacaoInicial: dec(d.dotacaoInicial),
    suplementado: dec(d.suplementado),
    dotacaoAtualizada: dec(d.dotacaoAtualizada),
    empenhado: dec(d.empenhado),
    liquidado: dec(d.liquidado),
    aLiquidar: dec(d.aLiquidar),
    pago: dec(d.pago),
  };
}

export const qddToInserts = (ds: DotacaoQdd[]) => ds.map(qddToInsert);

export function rowToLei(row: LeiRow): Lei {
  return {
    id: row.id,
    tipo: row.tipo as TipoLei,
    ordem: row.ordem,
    numero: row.numero,
    data: row.data,
    doe: row.doe,
    ementa: row.ementa,
    orgao: row.orgao,
    url: row.url,
    sensivelGenero: row.sensivelGenero,
    citacoes: row.citacoes,
    metas: row.metas,
  };
}

export function leiToInsert(l: Lei): LeiInsert {
  return {
    id: l.id,
    tipo: l.tipo,
    ordem: l.ordem,
    numero: l.numero,
    data: l.data,
    doe: l.doe,
    ementa: l.ementa,
    orgao: l.orgao,
    url: l.url,
    sensivelGenero: l.sensivelGenero,
    citacoes: l.citacoes,
    metas: l.metas,
  };
}

export const leisToInserts = (ls: Lei[]) => ls.map(leiToInsert);
