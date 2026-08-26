import type { Lei, Registro, TipoLei } from "../types";
import type { LeiInsert, LeiRow, RegistroInsert, RegistroRow } from "./schema";

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
