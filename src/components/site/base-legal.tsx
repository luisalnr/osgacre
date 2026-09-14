"use client";

import { useMemo, useState } from "react";
import { ExternalLink, Search } from "lucide-react";
import { ORDEM_TIPOS, ROTULO_TIPO } from "@/lib/parser-leis";
import { chave } from "@/lib/referencias";
import type { Lei, TipoLei } from "@/lib/types";
import {
  Botao,
  Card,
  Entrada,
  Etiqueta,
  Secao,
  TituloSecao,
} from "@/components/ui/primitivos";
import { cn } from "@/lib/utils";

/** Quantos entram a cada "Mostrar mais" — mesmo passo da tabela do painel. */
const PAGINA = 24;

/** Quantos aparecem de saída. Seis fileiras de dois no desktop. */
const INICIAL = 12;

/**
 * Instrumentos legais que embasam o OSG, agrupados nas mesmas seis categorias da
 * planilha de histórico. Cada item leva ao texto integral no legis.ac.gov.br.
 *
 * São quase 180 registros, por isso a busca é parte da seção e não um extra: sem
 * ela a lista vira um paredão. Os valores da aba LOA (RP, outras fontes e total)
 * ficam fora de propósito — aqui a seção mostra a citação, não o montante.
 */
export function BaseLegal({ leis }: { leis: Lei[] }) {
  return (
    <Secao id="base-legal">
      <TituloSecao
        sobretitulo="Instrumentos legais"
        titulo="A base legal do OSG no Acre"
        descricao="Leis, decretos e instrumentos de planejamento que citam mulheres, gênero ou o próprio Orçamento Sensível ao Gênero. Clique no número para abrir o texto integral no repositório de legislação do Estado."
      />
      <ListaInstrumentos leis={leis} />
    </Secao>
  );
}

/**
 * O miolo da lista, sem moldura de seção.
 *
 * Separado de `BaseLegal` porque o painel mostra a mesma lista sob a sua própria
 * casca — lá o título e a descrição vêm do banner da seção, e repetir o
 * `TituloSecao` duplicaria o cabeçalho. A lógica vive só aqui.
 */
export function ListaInstrumentos({ leis }: { leis: Lei[] }) {
  const [tipo, setTipo] = useState<TipoLei>("lei_ordinaria");
  const [busca, setBusca] = useState("");
  const [visiveis, setVisiveis] = useState(INICIAL);

  /**
   * Trocar de aba ou buscar recomeça a janela. Sem isto, quem abriu as 79 leis
   * ordinárias cairia na aba seguinte já toda expandida, e a busca mostraria o
   * recorte novo com o tamanho antigo.
   *
   * O reset mora aqui, e não num efeito: quem muda o recorte são estes dois
   * eventos, e `setState` dentro de efeito dispara render em cascata.
   */
  const trocarTipo = (t: TipoLei) => {
    setTipo(t);
    setVisiveis(INICIAL);
  };

  const trocarBusca = (termo: string) => {
    setBusca(termo);
    setVisiveis(INICIAL);
  };

  const porTipo = useMemo(() => {
    const mapa = new Map<TipoLei, Lei[]>();
    for (const t of ORDEM_TIPOS) mapa.set(t, []);
    for (const l of leis) mapa.get(l.tipo)?.push(l);
    for (const lista of mapa.values()) lista.sort((a, b) => b.ordem - a.ordem);
    return mapa;
  }, [leis]);

  const filtrados = useMemo(() => {
    const lista = porTipo.get(tipo) ?? [];
    const termo = chave(busca);
    if (!termo) return lista;
    return lista.filter((l) =>
      chave(`${l.numero} ${l.ementa} ${l.orgao} ${l.metas}`).includes(termo)
    );
  }, [porTipo, tipo, busca]);

  const total = porTipo.get(tipo)?.length ?? 0;
  const naTela = filtrados.slice(0, visiveis);
  const restantes = filtrados.length - naTela.length;

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center gap-2">
        {ORDEM_TIPOS.map((t) => {
          const n = porTipo.get(t)?.length ?? 0;
          const ativo = t === tipo;
          return (
            <button
              key={t}
              type="button"
              onClick={() => trocarTipo(t)}
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
          onChange={(e) => trocarBusca(e.target.value)}
          placeholder="Buscar por número, ementa ou órgão"
          aria-label="Buscar instrumento legal"
          className="pl-9"
        />
      </div>

      <p className="mb-4 text-sm text-texto-3">
        {busca
          ? `${filtrados.length} de ${total} registros`
          : `${total} registros em ${ROTULO_TIPO[tipo].toLowerCase()}`}
      </p>

      {/* Terceira coluna na faixa larga: mantém a ementa em linha curta em vez
          de esticar dois cartões de ~860px. */}
      <ul className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
        {naTela.map((l) => (
          <li key={l.id}>
            {/*
              h-full: o <li> já estica para a altura da fileira por ser item de
              grid, mas o cartão dentro dele encolhia para o próprio conteúdo —
              e ementas de tamanhos diferentes deixavam a dupla desalinhada.
            */}
            <Card className="h-full p-4 transition-shadow hover:shadow-card-alta">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
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
                </div>

                {/* Só a data. A contagem de citações da planilha ("0/1
                    citações") saiu daqui: ela conta ocorrências dentro do
                    documento, não diz nada sobre o OSG, e num cartão que já é
                    número, ementa e órgão só competia por atenção. O campo
                    continua na base, para quem precisar dele um dia. */}
                <div className="shrink-0">
                  {l.doe ? (
                    <Etiqueta>DOE {l.doe}</Etiqueta>
                  ) : l.data ? (
                    <Etiqueta>{l.data}</Etiqueta>
                  ) : null}
                </div>
              </div>
              <p className="mt-1.5 text-pretty text-sm leading-relaxed text-texto-2">
                {l.ementa}
              </p>
              {l.orgao ? (
                <p className="mt-2 text-xs text-texto-3">
                  <span className="font-medium">Órgão: </span>
                  {l.orgao}
                </p>
              ) : null}
              {/*
                Metas é o campo mais alto do conjunto — texto com quebras
                preservadas, em 10 dos 179 registros. Fechado por padrão para
                não ditar a altura dos outros 169. <details> nativo já vem
                acessível por teclado e dispensa estado.
              */}
              {l.metas ? (
                <details className="group mt-2">
                  <summary className="cursor-pointer list-none text-xs font-medium text-texto-3 hover:text-texto-2">
                    Metas e prioridades
                    <span className="ml-1 inline-block transition-transform group-open:rotate-90">
                      ›
                    </span>
                  </summary>
                  <p className="mt-1.5 whitespace-pre-line text-xs leading-relaxed text-texto-3">
                    {l.metas}
                  </p>
                </details>
              ) : null}
            </Card>
          </li>
        ))}
      </ul>

      {restantes > 0 ? (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-4">
          <Botao
            variante="secundario"
            onClick={() => setVisiveis((v) => v + PAGINA)}
          >
            Mostrar mais {Math.min(PAGINA, restantes)} de {restantes} restantes
          </Botao>
          {/* Atalho para quem prefere o Ctrl+F do navegador à busca da seção. */}
          <button
            type="button"
            onClick={() => setVisiveis(filtrados.length)}
            className="text-sm text-texto-3 underline underline-offset-4 hover:text-lilas"
          >
            Mostrar todos os {filtrados.length}
          </button>
        </div>
      ) : null}

      {!filtrados.length ? (
        <p className="rounded-card border border-dashed border-borda-forte p-8 text-center text-sm text-texto-3">
          Nenhum instrumento encontrado para esta busca.
        </p>
      ) : null}
    </>
  );
}
