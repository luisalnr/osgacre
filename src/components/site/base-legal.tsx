"use client";

import { useMemo, useState } from "react";
import { ExternalLink, Search } from "lucide-react";
import { ORDEM_TIPOS, ROTULO_TIPO } from "@/lib/parser-leis";
import { chave } from "@/lib/referencias";
import type { Lei, TipoLei } from "@/lib/types";
import { Card, Entrada, Etiqueta, Secao, TituloSecao } from "@/components/ui/primitivos";
import { cn } from "@/lib/utils";

/**
 * Instrumentos legais que embasam o OSG, agrupados nas mesmas seis categorias da
 * planilha de histórico. Cada item leva ao texto integral no legis.ac.gov.br.
 *
 * São quase 180 registros, por isso a busca é parte da seção e não um extra: sem
 * ela a lista vira um paredão. Os valores da aba LOA (RP, outras fontes e total)
 * ficam fora de propósito — aqui a seção mostra a citação, não o montante.
 */
export function BaseLegal({ leis }: { leis: Lei[] }) {
  const [tipo, setTipo] = useState<TipoLei>("lei_ordinaria");
  const [busca, setBusca] = useState("");

  const porTipo = useMemo(() => {
    const mapa = new Map<TipoLei, Lei[]>();
    for (const t of ORDEM_TIPOS) mapa.set(t, []);
    for (const l of leis) mapa.get(l.tipo)?.push(l);
    for (const lista of mapa.values()) lista.sort((a, b) => b.ordem - a.ordem);
    return mapa;
  }, [leis]);

  const visiveis = useMemo(() => {
    const lista = porTipo.get(tipo) ?? [];
    const termo = chave(busca);
    if (!termo) return lista;
    return lista.filter((l) =>
      chave(`${l.numero} ${l.ementa} ${l.orgao} ${l.metas}`).includes(termo)
    );
  }, [porTipo, tipo, busca]);

  const total = porTipo.get(tipo)?.length ?? 0;

  return (
    <Secao id="base-legal">
      <TituloSecao
        sobretitulo="Instrumentos legais"
        titulo="A base legal do OSG no Acre"
        descricao="Leis, decretos e instrumentos de planejamento que citam mulheres, gênero ou o próprio Orçamento Sensível ao Gênero. Clique no número para abrir o texto integral no repositório de legislação do Estado."
      />

      <div className="mb-5 flex flex-wrap items-center gap-2">
        {ORDEM_TIPOS.map((t) => {
          const n = porTipo.get(t)?.length ?? 0;
          const ativo = t === tipo;
          return (
            <button
              key={t}
              type="button"
              onClick={() => setTipo(t)}
              aria-pressed={ativo}
              className={cn(
                "inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                ativo
                  ? "border-lilas bg-lilas text-white"
                  : "border-borda bg-superficie text-texto-2 hover:bg-superficie-2"
              )}
            >
              {ROTULO_TIPO[t]}
              <span
                className={cn(
                  "tabular rounded px-1.5 text-xs",
                  ativo ? "bg-white/20 text-white" : "bg-superficie-2 text-texto-3"
                )}
              >
                {n}
              </span>
            </button>
          );
        })}
      </div>

      <div className="relative mb-4 max-w-md">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-texto-3"
          aria-hidden
        />
        <Entrada
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por número, ementa ou órgão"
          aria-label="Buscar instrumento legal"
          className="pl-9"
        />
      </div>

      <p className="mb-4 text-sm text-texto-3">
        {busca
          ? `${visiveis.length} de ${total} registros`
          : `${total} registros em ${ROTULO_TIPO[tipo].toLowerCase()}`}
      </p>

      <ul className="space-y-3">
        {visiveis.map((l) => (
          <li key={l.id}>
            <Card className="p-4 transition-shadow hover:shadow-card-alta">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  {l.url ? (
                    <a
                      href={l.url}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="inline-flex items-center gap-1.5 text-sm font-semibold text-lilas hover:underline"
                    >
                      {l.numero}
                      <ExternalLink className="size-3.5 shrink-0" aria-hidden />
                      <span className="sr-only">(abre em nova aba)</span>
                    </a>
                  ) : (
                    <span className="text-sm font-semibold text-texto">{l.numero}</span>
                  )}
                  <p className="mt-1.5 text-pretty text-sm leading-relaxed text-texto-2">
                    {l.ementa}
                  </p>
                  {l.orgao ? (
                    <p className="mt-2 text-xs text-texto-3">
                      <span className="font-medium">Órgão: </span>
                      {l.orgao}
                    </p>
                  ) : null}
                  {l.metas ? (
                    <p className="mt-2 whitespace-pre-line text-xs leading-relaxed text-texto-3">
                      <span className="font-medium">Metas e prioridades: </span>
                      {l.metas}
                    </p>
                  ) : null}
                </div>

                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  {l.doe ? (
                    <Etiqueta>DOE {l.doe}</Etiqueta>
                  ) : l.data ? (
                    <Etiqueta>{l.data}</Etiqueta>
                  ) : null}
                  {l.citacoes ? (
                    <span className="text-xs text-texto-3">
                      {l.citacoes} citações
                    </span>
                  ) : null}
                </div>
              </div>
            </Card>
          </li>
        ))}
      </ul>

      {!visiveis.length ? (
        <p className="rounded-card border border-dashed border-borda-forte p-8 text-center text-sm text-texto-3">
          Nenhum instrumento encontrado para esta busca.
        </p>
      ) : null}
    </Secao>
  );
}
