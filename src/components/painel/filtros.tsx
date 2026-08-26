"use client";

import { useState } from "react";
import { ChevronDown, Search, SlidersHorizontal, X } from "lucide-react";
import type { Opcoes } from "@/lib/agregacoes";
import { filtrosAtivos } from "@/lib/agregacoes";
import type { Filtros } from "@/lib/types";
import { Botao, Campo, Entrada } from "@/components/ui/primitivos";
import { cn } from "@/lib/utils";
import { MultiSelect } from "./multi-select";

/**
 * Barra de filtros.
 *
 * O exercício é seleção ÚNICA de propósito: somar apropriações de anos
 * diferentes não significa nada, porque cada exercício tem sua própria LOA. Os
 * demais filtros são múltiplos, e vazio quer dizer "todos".
 *
 * No celular os cinco campos empilhados tomariam a tela inteira, então ali a
 * barra recolhe (só exercício + botão) e deixa de ser fixa; a partir de `md` ela
 * volta a ser uma linha fixa no topo.
 */
export function BarraFiltros({
  filtros,
  opcoes,
  aoMudar,
}: {
  filtros: Filtros;
  opcoes: Opcoes;
  aoMudar: (f: Filtros) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const ativos = filtrosAtivos(filtros);

  const limpar = () =>
    aoMudar({ ...filtros, eixos: [], categorias: [], orgaos: [], busca: "" });

  return (
    <div className="border-b border-borda bg-fundo/95 backdrop-blur md:sticky md:top-0 md:z-30">
      <div className="mx-auto w-full max-w-7xl px-5 py-4 sm:px-8">
        {/* Linha compacta do celular */}
        <div className="flex items-end gap-3 md:hidden">
          <Campo rotulo="Exercício" className="w-32">
            <SeletorAno filtros={filtros} opcoes={opcoes} aoMudar={aoMudar} />
          </Campo>
          <Botao
            variante="secundario"
            onClick={() => setAberto((v) => !v)}
            aria-expanded={aberto}
            className="flex-1"
          >
            <SlidersHorizontal className="size-4" aria-hidden />
            Filtros
            {ativos ? (
              <span className="tabular rounded bg-lilas px-1.5 text-xs text-white">
                {ativos}
              </span>
            ) : null}
            <ChevronDown
              className={cn("size-4 transition-transform", aberto && "rotate-180")}
              aria-hidden
            />
          </Botao>
        </div>

        <div
          className={cn(
            "grid gap-3 md:grid-cols-2 lg:grid-cols-[auto_1fr_1fr_1fr_1.4fr_auto] lg:items-end",
            aberto ? "mt-3 md:mt-0" : "hidden md:grid"
          )}
        >
          <Campo rotulo="Exercício" className="hidden md:flex lg:w-32">
            <SeletorAno filtros={filtros} opcoes={opcoes} aoMudar={aoMudar} />
          </Campo>

          <MultiSelect
            rotulo="Eixo"
            opcoes={opcoes.eixos}
            selecionados={filtros.eixos}
            aoMudar={(eixos) => aoMudar({ ...filtros, eixos })}
          />

          <MultiSelect
            rotulo="Categoria"
            opcoes={opcoes.categorias.map((c) => ({
              valor: String(c),
              rotulo: `Categoria ${c}`,
            }))}
            selecionados={filtros.categorias.map(String)}
            aoMudar={(cs) =>
              aoMudar({ ...filtros, categorias: cs.map(Number).filter(Boolean) })
            }
          />

          <MultiSelect
            rotulo="Órgão executor"
            opcoes={opcoes.orgaos}
            selecionados={filtros.orgaos}
            aoMudar={(orgaos) => aoMudar({ ...filtros, orgaos })}
          />

          <Campo rotulo="Buscar">
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-texto-3"
                aria-hidden
              />
              <Entrada
                value={filtros.busca}
                onChange={(e) => aoMudar({ ...filtros, busca: e.target.value })}
                placeholder="Dotação, entrega ou código"
                className="pl-9"
              />
            </div>
          </Campo>

          <Botao variante="secundario" onClick={limpar} disabled={!ativos}>
            <X className="size-4" aria-hidden />
            Limpar
            {ativos ? (
              <span className="tabular rounded bg-superficie-2 px-1.5 text-xs text-texto-2">
                {ativos}
              </span>
            ) : null}
          </Botao>
        </div>
      </div>
    </div>
  );
}

function SeletorAno({
  filtros,
  opcoes,
  aoMudar,
}: {
  filtros: Filtros;
  opcoes: Opcoes;
  aoMudar: (f: Filtros) => void;
}) {
  return (
    <select
      value={filtros.ano ?? ""}
      onChange={(e) => aoMudar({ ...filtros, ano: Number(e.target.value) || null })}
      className="h-10 w-full rounded-lg border border-borda-forte bg-superficie px-3 text-sm text-texto"
      aria-label="Exercício"
    >
      {opcoes.anos.map((a) => (
        <option key={a} value={a}>
          {a}
        </option>
      ))}
    </select>
  );
}
