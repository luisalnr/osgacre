"use client";

import { useState } from "react";
import { ChevronDown, Search, SlidersHorizontal, X } from "lucide-react";
import type { Opcoes } from "@/lib/agregacoes";
import { filtrosAtivos } from "@/lib/agregacoes";
import type { Filtros } from "@/lib/types";
import {
  Botao,
  Campo,
  Entrada,
  LARGURA_CONTEUDO,
} from "@/components/ui/primitivos";
import { cn } from "@/lib/utils";
import { MultiSelect } from "./multi-select";

/**
 * Barra de filtros.
 *
 * O exercício é seleção ÚNICA de propósito: somar apropriações de anos
 * diferentes não significa nada, porque cada exercício tem sua própria LOA. Os
 * demais filtros são múltiplos, e vazio quer dizer "todos".
 *
 * No celular os campos empilhados tomariam a tela inteira, então ali a barra
 * recolhe (só exercício + botão) e deixa de ser fixa; a partir de `md` ela volta
 * a ser fixa no topo. A linha única só cabe em `xl`: com sete campos, forçá-la
 * em `lg` deixaria cada controle com menos de 130px.
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
    aoMudar({
      ...filtros,
      eixos: [],
      categorias: [],
      orgaos: [],
      unidades: [],
      busca: "",
    });

  /*
    Unidade em cascata: a lista mostra só o que pertence aos órgãos escolhidos.
    Sem órgão escolhido são as 28, e aí o rótulo precisa da sigla na frente —
    "UNIDADE GESTORA" é o nome da unidade 001 em onze órgãos, e sem qualificação
    a lista teria onze linhas idênticas. Restrita a um órgão só, a sigla vira
    ruído e o rótulo curto basta.
  */
  const unidadesVisiveis = filtros.orgaos.length
    ? opcoes.unidades.filter((u) =>
        filtros.orgaos.includes(u.valor.split("/")[0])
      )
    : opcoes.unidades;
  const umOrgaoSo =
    new Set(unidadesVisiveis.map((u) => u.valor.split("/")[0])).size === 1;

  /*
    Trocar de órgão poda as unidades que saíram do recorte.

    Sem isto dá para deixar marcado "órgão SEOP" com "unidade do FUNDHACRE", que
    é uma interseção vazia: o painel zeraria sem dizer por quê, e o usuário veria
    dois filtros preenchidos e nenhum dado. A poda vai no mesmo `aoMudar` da
    troca de órgão, e não num efeito, para o estado nunca passar pelo intervalo
    inconsistente.
  */
  const mudarOrgaos = (orgaos: string[]) =>
    aoMudar({
      ...filtros,
      orgaos,
      unidades: orgaos.length
        ? filtros.unidades.filter((u) => orgaos.includes(u.split("/")[0]))
        : filtros.unidades,
    });

  return (
    <div className="border-b border-borda bg-fundo/95 backdrop-blur md:sticky md:top-0 md:z-30">
      <div className={cn(LARGURA_CONTEUDO, "py-4")}>
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
            "grid gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-[auto_1fr_1fr_1fr_1fr_1.4fr_auto] xl:items-end",
            aberto ? "mt-3 md:mt-0" : "hidden md:grid"
          )}
        >
          {/* w-36, não w-32: o ano precisa caber sem encostar na seta. */}
          <Campo rotulo="Exercício" className="hidden md:flex xl:w-36">
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
            rotulo="Órgão"
            opcoes={opcoes.orgaos}
            selecionados={filtros.orgaos}
            aoMudar={mudarOrgaos}
          />

          <MultiSelect
            rotulo="Unidade"
            opcoes={unidadesVisiveis.map((u) => ({
              valor: u.valor,
              rotulo: umOrgaoSo ? u.rotulo : u.rotuloComOrgao,
            }))}
            selecionados={filtros.unidades}
            aoMudar={(unidades) => aoMudar({ ...filtros, unidades })}
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
  /*
    Continua sendo um <select> nativo — é o controle certo para seleção única,
    e no celular abre a roda do sistema, que nenhum menu próprio iguala.
    O que muda é a moldura: `appearance-none` tira a seta desenhada pelo sistema
    operacional e põe no lugar o mesmo ChevronDown, na mesma posição e cor, dos
    MultiSelect ao lado. Sem isso o campo destoa dos vizinhos.
  */
  return (
    <div className="relative">
      <select
        value={filtros.ano ?? ""}
        onChange={(e) => aoMudar({ ...filtros, ano: Number(e.target.value) || null })}
        className="h-10 w-full appearance-none rounded-lg border border-borda-forte bg-superficie pl-3 pr-9 text-sm text-texto"
        aria-label="Exercício"
      >
        {opcoes.anos.map((a) => (
          <option key={a} value={a}>
            {a}
          </option>
        ))}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-texto-3"
        aria-hidden
      />
    </div>
  );
}
