"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Download, FileSpreadsheet, FileText, Info } from "lucide-react";
import { toast } from "sonner";
import {
  anosDisponiveis,
  calcularTotais,
  filtrar,
  indexarQdd,
  opcoesDeFiltro,
  porFuncao,
  porOrgao,
  reconciliarFiltros,
} from "@/lib/agregacoes";
import { exportarPdf, exportarXlsx } from "@/lib/exportar";
import { METODOLOGIA_PARTES, NOTA_EM_APURACAO } from "@/lib/conteudo";
import { emApuracao } from "@/lib/referencias";
import {
  FILTROS_VAZIOS,
  type DotacaoQdd,
  type Filtros,
  type Registro,
} from "@/lib/types";
import type { Lei } from "@/lib/types";
import { Botao, LARGURA_CONTEUDO } from "@/components/ui/primitivos";
import { ListaInstrumentos } from "@/components/site/base-legal";
import { cn } from "@/lib/utils";
import { Sidebar } from "./sidebar";
import {
  ehSecaoId,
  permiteExportar,
  SECAO_PADRAO,
  SECOES,
  usaFiltrosDeDotacao,
  type SecaoId,
} from "./secoes";
import { BarraFiltros } from "./filtros";
import { Kpis } from "./kpis";
import { PainelOds } from "./ods";
import { TabelaDotacoes } from "./tabela";
import { BarrasSimples } from "./charts/barras-simples";
import { GraficoDotacoesPorEixo } from "./charts/dotacoes-por-eixo";
import { GraficoEvolucao } from "./charts/evolucao";
import { GraficoPorCategoria } from "./charts/por-categoria";
import { GraficoPorEixo } from "./charts/por-eixo";

function anoPadraoDoPainel(anos: number[]): number | null {
  // O painel abre no exercício fechado mais recente, sem esconder os anos em
  // apuração do seletor. Quando 2026 sair de EXERCICIOS_EM_APURACAO, ele passa
  // automaticamente a ser o padrão. Se todos estiverem abertos, recua para o
  // ano mais recente disponível para o painel nunca começar sem dados.
  return anos.find((ano) => !emApuracao(ano)) ?? anos[0] ?? null;
}

export function Painel({
  registros,
  qdd,
  leis,
}: {
  registros: Registro[];
  qdd: DotacaoQdd[];
  leis: Lei[];
}) {
  const parametros = useSearchParams();
  /**
   * A seção ativa é estado de interface, não de dados: a URL só manda na
   * primeira renderização, para um link compartilhado abrir na aba certa.
   *
   * Antes ela era lida da URL a cada render e trocada por `router.replace`. Como
   * `/painel` é `force-dynamic`, cada clique na barra lateral disparava uma
   * navegação do App Router — ida ao servidor, releitura dos dados e o payload
   * inteiro de volta — só para mostrar uma seção que já estava no navegador. Era
   * a maior parte da demora ao trocar de aba.
   */
  const [secaoId, setSecaoId] = useState<SecaoId>(() => {
    const aba = parametros.get("aba");
    return ehSecaoId(aba) ? aba : SECAO_PADRAO;
  });
  const [recolhida, setRecolhida] = useState(false);
  const secao = SECOES.find((s) => s.id === secaoId) ?? SECOES[0];
  const IconeSecao = secao.icone;
  const comFiltros = usaFiltrosDeDotacao(secaoId);
  const podeExportar = permiteExportar(secaoId);

  // Os exercícios saem da base inteira e alimentam o estado inicial; as opções
  // de órgão e unidade saem do exercício selecionado. Sem separar os dois, o
  // estado inicial dependeria de `opcoes` e `opcoes` do estado — um ciclo.
  const anos = useMemo(() => anosDisponiveis(registros), [registros]);
  const indiceQdd = useMemo(() => (qdd.length ? indexarQdd(qdd) : null), [qdd]);
  const [filtros, setFiltros] = useState<Filtros>(() => ({
    ...FILTROS_VAZIOS,
    ano: anoPadraoDoPainel(anos),
  }));
  const opcoes = useMemo(
    () => opcoesDeFiltro(registros, filtros.ano),
    [registros, filtros.ano]
  );
  const [exportando, setExportando] = useState<"xlsx" | "pdf" | null>(null);

  const trocarSecao = (id: SecaoId) => {
    setSecaoId(id);
    // `history.replaceState` em vez do router: mantém a aba na URL — o link
    // continua compartilhável — sem pedir nada ao servidor. Como o
    // `router.replace` de antes, não cria entrada no histórico, então o botão
    // Voltar segue saindo do painel em vez de desfazer a troca de aba.
    const novos = new URLSearchParams(window.location.search);
    novos.set("aba", id);
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}?${novos.toString()}`
    );
  };

  /**
   * Troca de exercício poda a seleção de órgão e unidade que não existe no ano
   * novo, e diz o que saiu.
   *
   * A poda vai aqui, no mesmo `aoMudar` da troca, e não num efeito — é a mesma
   * regra que a cascata órgão→unidade em `filtros.tsx` já segue, para o estado
   * nunca passar pelo intervalo em que o ano é novo e a seleção ainda é velha.
   *
   * E vai neste componente, e não na barra: só aqui existem os registros para
   * saber o que o exercício de DESTINO contém. A barra só recebe as opções do
   * exercício corrente.
   */
  const aoMudarFiltros = (novos: Filtros) => {
    if (novos.ano === filtros.ano) {
      setFiltros(novos);
      return;
    }
    const r = reconciliarFiltros(novos, opcoesDeFiltro(registros, novos.ano));
    setFiltros(r.filtros);

    if (!r.orgaosRemovidos.length && !r.unidadesRemovidas) return;
    // O nome sai das opções do exercício de onde se saiu — nas do novo esses
    // órgãos não existem mais, que é justamente por que foram retirados.
    const nomes = r.orgaosRemovidos.map(
      (c) => opcoes.orgaos.find((o) => o.valor === c)?.rotulo ?? c
    );
    const lista =
      nomes.length <= 3
        ? nomes.join(", ")
        : `${nomes.slice(0, 3).join(", ")} e mais ${nomes.length - 3}`;
    const oQue = nomes.length
      ? lista
      : `${r.unidadesRemovidas} unidade${r.unidadesRemovidas > 1 ? "s" : ""}`;
    const complemento =
      nomes.length && r.unidadesRemovidas
        ? ` (e ${r.unidadesRemovidas} unidade${r.unidadesRemovidas > 1 ? "s" : ""})`
        : "";
    toast.info(
      `${oQue}${complemento} sem dotações em ${novos.ano}. Saiu do filtro.`
    );
  };

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

  // Estes dois estavam sendo chamados direto no JSX, e por isso refaziam a
  // varredura de `filtrados` a cada render — inclusive quando o que mudava era
  // a barra lateral recolhendo ou o botão de exportação entrando em "Gerando…".
  const fatiasFuncao = useMemo(() => porFuncao(filtrados), [filtrados]);
  const fatiasOrgao = useMemo(() => porOrgao(filtrados, 10), [filtrados]);

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
      {/*
        A faixa verde atravessa a tela inteira, acima da barra lateral — e por
        isso fica fora do flex, não dentro da coluna de conteúdo. Sem largura
        máxima: o título encosta na borda esquerda, alinhado com a lateral.
      */}
      <header className="border-b border-borda bg-verde-escuro">
        <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-5 sm:px-8">
          <div className="flex min-w-0 flex-1 items-center gap-4">
            {/* Só a versão branca: esta faixa é verde-escura nos dois temas.
                Mesma caixa do cabeçalho do site, na proporção 4,125:1 do
                arquivo. */}
            <span className="relative block h-10 w-[165px] shrink-0">
              <Image
                src="/logos/seplan-horizontal-branco.png"
                alt="SEPLAN — Secretaria de Estado de Planejamento do Acre"
                fill
                priority
                sizes="165px"
                className="object-contain object-left"
              />
            </span>
            <span className="hidden h-8 w-px bg-white/25 sm:block" />
            <h1 className="min-w-0 text-xl font-semibold tracking-tight text-white sm:text-2xl">
              Painel do Orçamento Sensível ao Gênero
            </h1>
          </div>
          {/* Só na Tabela Detalhada: é aquela tabela que os dois arquivos
              reproduzem. Ao lado dos gráficos, os botões sugeririam que sairiam
              os gráficos. */}
          {podeExportar ? (
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
          ) : null}
        </div>
      </header>

      {/*
        Empilha no celular: abaixo de `lg` a Sidebar rende uma fileira
        horizontal em vez da coluna, e num flex em linha ela ficaria ao lado do
        conteúdo em vez de acima dele.
      */}
      <div className="flex flex-col lg:flex-row">
        <Sidebar
          ativa={secaoId}
          aoTrocar={trocarSecao}
          recolhida={recolhida}
          aoRecolher={() => setRecolhida((v) => !v)}
        />

        <div className="min-w-0 flex-1">
          {/* Filtram dotações do OSG — não se aplicam à lista de normas. */}
          {comFiltros ? (
            <BarraFiltros filtros={filtros} opcoes={opcoes} aoMudar={aoMudarFiltros} />
          ) : null}

      {/* `surgir` só na montagem: a faixa verde e a barra lateral já estavam no
          esqueleto de `loading.tsx`, então só o conteúdo que chega com os dados
          entra animado. A troca de aba não remonta o <main> e não repete o efeito. */}
      <main className={cn(LARGURA_CONTEUDO, "surgir space-y-6 py-6")}>
        {/*
          Cabeçalho da seção, não mais um cartão entre os cartões: o fundo em
          lilás tênue e o ícone da própria seção o separam do conteúdo abaixo e
          amarram a tela ao item aceso na barra lateral.
        */}
        <section className="flex items-start gap-4 rounded-card border border-lilas/25 bg-lilas/5 px-5 py-4">
          <span className="mt-0.5 hidden shrink-0 rounded-lg bg-lilas/15 p-2 text-lilas sm:block">
            <IconeSecao className="size-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-texto">
              {secao.titulo}
            </h2>
            {/* Sem teto de largura: a descrição corre a largura inteira do
                cartão e cabe em uma linha só no desktop. Nada de
                `whitespace-nowrap` — em tela estreita ela precisa quebrar, sob
                pena de empurrar rolagem lateral na página. */}
            <p className="mt-1 text-pretty text-sm leading-relaxed text-texto-2">
              {secao.descricao}
            </p>
          </div>
        </section>

        {/* A ressalva fica acima do conteúdo e vale para as duas seções que
            usam os filtros de dotação: quem chega pelo link de uma delas
            precisa ler a condição antes dos números, não depois. */}
        {totais.emApuracao && (secaoId === "visao" || secaoId === "tabela") ? (
          <div className="flex items-start gap-2.5 rounded-lg border border-alerta/40 bg-alerta/10 px-4 py-3">
            <Info className="mt-0.5 size-4 shrink-0 text-alerta" aria-hidden />
            <p className="text-pretty text-xs leading-relaxed text-texto-2">
              <span className="font-medium text-texto">
                {NOTA_EM_APURACAO.titulo}:
              </span>{" "}
              {NOTA_EM_APURACAO.texto}
            </p>
          </div>
        ) : null}

        {secaoId === "visao" ? (
          <>
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
                titulo="Valor planejado por função orçamentária"
                subtitulo="Classificação funcional da despesa, conforme a Portaria MOG nº 42/1999 adotada pelo MTO."
                fatias={fatiasFuncao}
                larguraRotulo={196}
              />
              {/* `larguraRotulo` menor que o do gráfico ao lado: aqui os
                  rótulos são siglas de até oito caracteres, e a faixa larga
                  seria espaço morto tirado das barras. */}
              <BarrasSimples
                titulo="Dez maiores órgãos executores"
                subtitulo="Soma de todas as unidades de cada órgão, no recorte selecionado. O detalhe por unidade orçamentária está na tabela."
                fatias={fatiasOrgao}
                larguraRotulo={72}
              />
            </div>

            {/* `semAno` como no gráfico de evolução: comparar exercícios exige
                ignorar o filtro de exercício, mantendo os demais. */}
            <GraficoDotacoesPorEixo registros={semAno} />
          </>
        ) : null}

        {secaoId === "instrumentos" ? <ListaInstrumentos leis={leis} /> : null}

        {secaoId === "ods" ? <PainelOds /> : null}

        {secaoId === "tabela" ? (
          <>
            <TabelaDotacoes registros={filtrados} qdd={indiceQdd} />

            {/*
              A nota acompanha a tabela que ela explica: fala de abrir a linha e
              das colunas daquela grade, não dos KPIs da Visão Geral.
            */}
            <footer
              aria-labelledby="nota-metodologica"
              className="border-t border-borda pb-8 pt-6"
            >
              <h2
                id="nota-metodologica"
                className="text-xs font-semibold uppercase tracking-[0.14em] text-texto-3"
              >
                Nota metodológica
              </h2>
              <dl className="mt-5 grid gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-4">
                {METODOLOGIA_PARTES.map((parte) => (
                  <div key={parte.titulo} className="border-t border-borda pt-3">
                    <dt className="text-sm font-semibold text-texto">
                      {parte.titulo}
                    </dt>
                    <dd className="mt-1.5 text-pretty text-sm leading-relaxed text-texto-2">
                      {parte.texto}
                    </dd>
                  </div>
                ))}
              </dl>
              <p className="mt-7 flex items-start gap-2 text-xs leading-relaxed text-texto-3">
                <Download className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                <span className="text-pretty">
                  A exportação em XLSX e PDF sempre reproduz o recorte que
                  estiver aplicado nesta tela. Fonte: DEPPO/SEPLAN.
                </span>
              </p>
            </footer>
          </>
        ) : null}
          </main>
        </div>
      </div>
    </div>
  );
}
