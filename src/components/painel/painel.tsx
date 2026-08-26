"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Download, FileSpreadsheet, FileText } from "lucide-react";
import { toast } from "sonner";
import {
  calcularTotais,
  filtrar,
  indexarQdd,
  opcoesDeFiltro,
  porFuncao,
  porOrgao,
} from "@/lib/agregacoes";
import { exportarPdf, exportarXlsx } from "@/lib/exportar";
import { METODOLOGIA_NOTA } from "@/lib/conteudo";
import {
  FILTROS_VAZIOS,
  type DotacaoQdd,
  type Filtros,
  type Registro,
} from "@/lib/types";
import { Botao } from "@/components/ui/primitivos";
import { BarraFiltros } from "./filtros";
import { Kpis } from "./kpis";
import { TabelaDotacoes } from "./tabela";
import { BarrasSimples } from "./charts/barras-simples";
import { GraficoEvolucao } from "./charts/evolucao";
import { GraficoPorCategoria } from "./charts/por-categoria";
import { GraficoPorEixo } from "./charts/por-eixo";

export function Painel({
  registros,
  qdd,
}: {
  registros: Registro[];
  qdd: DotacaoQdd[];
}) {
  const opcoes = useMemo(() => opcoesDeFiltro(registros), [registros]);
  const indiceQdd = useMemo(() => (qdd.length ? indexarQdd(qdd) : null), [qdd]);
  const [filtros, setFiltros] = useState<Filtros>(() => ({
    ...FILTROS_VAZIOS,
    ano: opcoes.anos[0] ?? null,
  }));
  const [exportando, setExportando] = useState<"xlsx" | "pdf" | null>(null);

  const filtrados = useMemo(() => filtrar(registros, filtros), [registros, filtros]);
  const totais = useMemo(() => calcularTotais(filtrados), [filtrados]);

  // O comparativo usa o mesmo recorte, só trocando o exercício.
  const anoAnterior = useMemo(() => {
    if (filtros.ano === null) return null;
    const anteriores = opcoes.anos.filter((a) => a < filtros.ano!);
    return anteriores.length ? Math.max(...anteriores) : null;
  }, [filtros.ano, opcoes.anos]);

  const totaisAnteriores = useMemo(() => {
    if (anoAnterior === null) return null;
    return calcularTotais(filtrar(registros, { ...filtros, ano: anoAnterior }));
  }, [registros, filtros, anoAnterior]);

  // A evolução compara exercícios, então é o único recorte sem filtro de ano.
  const semAno = useMemo(
    () => filtrar(registros, { ...filtros, ano: null }),
    [registros, filtros]
  );

  const exportar = async (formato: "xlsx" | "pdf") => {
    if (!filtrados.length) {
      toast.error("Não há dados no recorte atual para exportar.");
      return;
    }
    setExportando(formato);
    try {
      if (formato === "xlsx")
        await exportarXlsx(filtrados, filtros, totais, indiceQdd);
      else await exportarPdf(filtrados, filtros, totais);
      toast.success(
        `Arquivo ${formato.toUpperCase()} gerado com ${totais.dotacoes} dotações.`
      );
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Não consegui gerar o arquivo."
      );
    } finally {
      setExportando(null);
    }
  };

  if (!registros.length) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-24 text-center">
        <h1 className="text-2xl font-semibold text-texto">Painel sem dados</h1>
        <p className="mt-3 text-sm leading-relaxed text-texto-2">
          Ainda não há registros do OSG carregados. Importe a planilha em{" "}
          <Link href="/admin" className="text-lilas hover:underline">
            /admin
          </Link>
          .
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-fundo">
      <div className="border-b border-borda bg-verde-escuro">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-5 sm:px-8">
          <div>
            <Link
              href="/"
              className="mb-1 inline-flex items-center gap-1.5 text-xs text-white/70 hover:text-white"
            >
              <ArrowLeft className="size-3.5" aria-hidden />
              Voltar ao site
            </Link>
            <h1 className="text-xl font-semibold tracking-tight text-white sm:text-2xl">
              Painel do Orçamento Sensível ao Gênero
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Botao
              variante="secundario"
              onClick={() => exportar("xlsx")}
              disabled={exportando !== null}
            >
              <FileSpreadsheet className="size-4" aria-hidden />
              {exportando === "xlsx" ? "Gerando…" : "XLSX"}
            </Botao>
            <Botao
              variante="secundario"
              onClick={() => exportar("pdf")}
              disabled={exportando !== null}
            >
              <FileText className="size-4" aria-hidden />
              {exportando === "pdf" ? "Gerando…" : "PDF"}
            </Botao>
          </div>
        </div>
      </div>

      <BarraFiltros filtros={filtros} opcoes={opcoes} aoMudar={setFiltros} />

      <main className="mx-auto w-full max-w-7xl space-y-6 px-5 py-6 sm:px-8">
        <Kpis
          totais={totais}
          anterior={totaisAnteriores}
          anoAnterior={anoAnterior}
        />

        <div className="grid gap-4 lg:grid-cols-2">
          <GraficoPorEixo registros={filtrados} />
          <div className="grid gap-4">
            <GraficoPorCategoria registros={filtrados} />
            <GraficoEvolucao registros={semAno} />
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <BarrasSimples
            titulo="Apropriação por função orçamentária"
            subtitulo="Classificação funcional da despesa, conforme a Portaria MOG nº 42/1999 adotada pelo MTO."
            fatias={porFuncao(filtrados)}
            larguraRotulo={196}
          />
          <BarrasSimples
            titulo="Dez maiores unidades executoras"
            subtitulo="Órgãos e unidades com maior apropriação no recorte selecionado."
            fatias={porOrgao(filtrados, 10)}
            larguraRotulo={132}
          />
        </div>

        <TabelaDotacoes registros={filtrados} qdd={indiceQdd} />

        <footer className="flex items-start gap-2 pb-8 text-xs leading-relaxed text-texto-3">
          <Download className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <p className="max-w-3xl text-pretty">
            {METODOLOGIA_NOTA} A exportação em XLSX e PDF sempre reproduz o
            recorte que estiver aplicado nesta tela. Fonte: DEPPO/SEPLAN.
          </p>
        </footer>
      </main>
    </div>
  );
}
