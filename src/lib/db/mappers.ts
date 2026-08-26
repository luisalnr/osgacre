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

export function rowToRegistro(row: RegistroRow): Registro {
  return {
    id: row.id,
    ano: row.ano,
    categoria: row.categoria,
    orgaoCodigo: row.orgaoCodigo,
    orgaoNome: row.orgaoNome,
    orgaoSigla: row.orgaoSigla,
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
  };
}

export function registroToInsert(r: Registro): RegistroInsert {
  return {
    id: r.id,
    ano: r.ano,
    categoria: r.categoria,
    orgaoCodigo: r.orgaoCodigo,
    orgaoNome: r.orgaoNome,
    orgaoSigla: r.orgaoSigla,
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
  };
}

export const registrosToInserts = (rs: Registro[]) => rs.map(registroToInsert);

export function rowToQdd(row: QddRow): DotacaoQdd {
  return {
    id: row.id,
    ano: row.ano,
    orgaoCodigo: row.orgaoCodigo,
    orgaoNome: row.orgaoNome,
    unidadeCodigo: row.unidadeCodigo,
    unidadeNome: row.unidadeNome,
    projetoAtividade: row.projetoAtividade,
    aplicacaoProgramada: row.aplicacaoProgramada,
    funcaoProgramatica: row.funcaoProgramatica,
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
