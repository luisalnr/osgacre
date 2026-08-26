"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  FileSpreadsheet,
  Gavel,
  LayoutList,
  LogOut,
  Table2,
} from "lucide-react";
import { toast } from "sonner";
import { checarContraQdd } from "@/lib/checagens-qdd";
import { moeda } from "@/lib/formato";
import { parseHistoricoLeis, ROTULO_TIPO } from "@/lib/parser-leis";
import { COLUNAS_OSG, parseTabelaOSG, type Aviso, type ResultadoOSG } from "@/lib/parser-osg";
import { COLUNAS_QDD, parseQdd, type ResultadoQdd } from "@/lib/parser-qdd";
import type { DotacaoQdd, Lei } from "@/lib/types";
import { lerAbas, type Aba } from "@/lib/xlsx-io";
import { Botao, Etiqueta } from "@/components/ui/primitivos";
import {
  BlocoImportacao,
  Colunas,
  ListaAvisos,
  Opcao,
  Resumo,
} from "./bloco-importacao";

type Modo = "substituir" | "mesclar";

export function Importacao({
  usuario,
}: {
  usuario: { nome: string; email: string };
}) {
  const router = useRouter();

  const sair = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.refresh();
  };

  return (
    <div className="min-h-dvh bg-fundo">
      <header className="border-b border-borda bg-verde-escuro">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-4 px-5 py-5 sm:px-8">
          <div>
            <Link
              href="/"
              className="mb-1 inline-flex items-center gap-1.5 text-xs text-white/70 hover:text-white"
            >
              <ArrowLeft className="size-3.5" aria-hidden />
              Voltar ao site
            </Link>
            <h1 className="text-xl font-semibold tracking-tight text-white">
              Importação de dados
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-white/70">
              {usuario.nome || usuario.email}
            </span>
            <Botao variante="secundario" tamanho="sm" onClick={sair}>
              <LogOut className="size-3.5" aria-hidden />
              Sair
            </Botao>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl space-y-6 px-5 py-8 sm:px-8">
        <p className="rounded-card border border-borda bg-superficie px-5 py-4 text-sm leading-relaxed text-texto-2">
          Importe o <strong className="font-medium text-texto">QDD</strong> antes da
          Tabela OSG: é ele que traz a dotação atualizada de cada ação orçamentária,
          usada para calcular a participação do OSG e para conferir os registros.
        </p>

        <ImportarQdd />
        <ImportarOSG />
        <ImportarLeis />
        <ImportarOrcamentosTematicos />
      </main>
    </div>
  );
}

function ImportarQdd() {
  const [previa, setPrevia] = useState<ResultadoQdd | null>(null);
  const [gravando, setGravando] = useState(false);

  const ler = async (file: File) => {
    const abas = lerAbas(await file.arrayBuffer());
    // O QDD sai do sistema com uma aba só; se vier mais, a primeira é a boa.
    const doNome = Number(file.name.match(/(\d{4})/)?.[1]) || undefined;
    let r = parseQdd(abas[0].linhas);
    if (!r.anos.length && doNome) r = parseQdd(abas[0].linhas, doNome);
    setPrevia(r);
    if (!r.dotacoes.length) {
      toast.error("Nenhuma dotação reconhecida no arquivo.");
      return false;
    }
  };

  const gravar = async () => {
    if (!previa?.dotacoes.length) return;
    setGravando(true);
    try {
      const r = await fetch("/api/qdd", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ qdd: previa.dotacoes }),
      });
      const dados = (await r.json()) as { erro?: string; gravados?: number };
      if (!r.ok) throw new Error(dados.erro ?? "Falha ao gravar.");
      toast.success(
        `${dados.gravados} dotações do QDD gravadas para ${previa.anos.join(", ")}.`
      );
      setPrevia(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao gravar.");
    } finally {
      setGravando(false);
    }
  };

  const semExercicio = previa !== null && !previa.anos.length;
  const totais = previa
    ? {
        inicial: previa.dotacoes.reduce((s, d) => s + d.dotacaoInicial, 0),
        atualizada: previa.dotacoes.reduce((s, d) => s + d.dotacaoAtualizada, 0),
        liquidado: previa.dotacoes.reduce((s, d) => s + d.liquidado, 0),
      }
    : null;

  return (
    <BlocoImportacao
      icone={Table2}
      titulo="QDD do exercício"
      descricao={
        <>
          Quadro de Detalhamento da Despesa (<code className="text-xs">QDD_AAAA.xls</code>).
          A coluna <code className="text-xs">Ini+Sup+Cor-Red (B)</code> é a dotação
          atualizada — é nela que aparecem os remanejamentos feitos durante o exercício
          e as emendas parlamentares, que entram na LOA zeradas.
        </>
      }
      aoLer={ler}
      limpar={() => setPrevia(null)}
      acao={
        previa?.dotacoes.length ? (
          <div className="flex items-center gap-3">
            <Botao onClick={gravar} disabled={gravando || semExercicio}>
              {gravando ? "Gravando…" : `Gravar ${previa.dotacoes.length} dotações`}
            </Botao>
            {semExercicio ? (
              <span className="text-xs text-critico">
                Sem exercício identificado — não dá para saber o que substituir.
              </span>
            ) : null}
          </div>
        ) : null
      }
    >
      {previa ? (
        <>
          <dl className="grid gap-3 sm:grid-cols-4">
            <Resumo rotulo="Exercício" valor={previa.anos.join(", ") || "—"} />
            <Resumo rotulo="Dotações" valor={String(previa.dotacoes.length)} />
            <Resumo rotulo="Dotação inicial" valor={moeda(totais?.inicial ?? 0)} />
            <Resumo rotulo="Dotação atualizada" valor={moeda(totais?.atualizada ?? 0)} />
          </dl>
          <p className="text-xs text-texto-3">
            {previa.linhasContabeis} linhas contábeis agregadas · liquidado{" "}
            {moeda(totais?.liquidado ?? 0)}
          </p>
          <Colunas esperadas={COLUNAS_QDD} encontradas={previa.colunasEncontradas} />
          <ListaAvisos
            avisos={previa.avisos.map((m) => ({
              nivel: "aviso" as const,
              mensagem: m,
              linhas: [],
            }))}
          />
          <p className="rounded-lg border border-borda bg-superficie-2/60 px-3 py-2 text-xs leading-relaxed text-texto-2">
            A gravação substitui o exercício inteiro. O QDD é um retrato completo do
            orçamento, e uma dotação anulada precisa sumir — mesclar a manteria viva
            para sempre.
          </p>
        </>
      ) : null}
    </BlocoImportacao>
  );
}

function ImportarOSG() {
  const [previa, setPrevia] = useState<ResultadoOSG | null>(null);
  const [avisosQdd, setAvisosQdd] = useState<Aviso[]>([]);
  const [modo, setModo] = useState<Modo>("substituir");
  const [gravando, setGravando] = useState(false);

  const ler = async (file: File) => {
    const abas = lerAbas(await file.arrayBuffer());
    const alvo =
      abas.find((a) => a.nome.trim().toLowerCase() === "tabela_osg") ?? abas[0];
    if (!alvo) {
      toast.error("A planilha não tem nenhuma aba legível.");
      return false;
    }
    const r = parseTabelaOSG(alvo.linhas);
    setPrevia(r);
    if (!r.registros.length) {
      toast.error("Nenhuma linha reconhecida na planilha.");
      return false;
    }

    // A conferência das dotações depende do QDD já carregado no banco.
    try {
      const resp = await fetch(`/api/qdd?anos=${r.anos.join(",")}`, {
        cache: "no-store",
      });
      const dados = (await resp.json()) as { qdd?: DotacaoQdd[] };
      setAvisosQdd(checarContraQdd(r.registros, dados.qdd ?? []).avisos);
    } catch {
      setAvisosQdd([
        {
          nivel: "aviso",
          mensagem: "Não consegui ler o QDD para conferir as dotações.",
          linhas: [],
        },
      ]);
    }
  };

  const gravar = async () => {
    if (!previa?.registros.length) return;
    setGravando(true);
    try {
      const r = await fetch("/api/registros", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ registros: previa.registros, modo }),
      });
      const dados = (await r.json()) as { erro?: string; gravados?: number };
      if (!r.ok) throw new Error(dados.erro ?? "Falha ao gravar.");
      toast.success(
        `${dados.gravados} registros gravados nos exercícios ${previa.anos.join(", ")}.`
      );
      setPrevia(null);
      setAvisosQdd([]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao gravar.");
    } finally {
      setGravando(false);
    }
  };

  const erros = previa?.avisos.filter((a) => a.nivel === "erro") ?? [];
  const totalAprop = previa?.registros.reduce((s, r) => s + r.apropOsg, 0) ?? 0;
  const totalLiq = previa?.registros.reduce((s, r) => s + r.liqOsg, 0) ?? 0;

  return (
    <BlocoImportacao
      icone={FileSpreadsheet}
      titulo="Tabela OSG"
      descricao={
        <>
          Arquivo <code className="text-xs">OSG TOTAL.xlsx</code>, aba{" "}
          <code className="text-xs">Tabela_OSG</code>. Uma linha por entrega apropriada.
        </>
      }
      aoLer={ler}
      limpar={() => {
        setPrevia(null);
        setAvisosQdd([]);
      }}
      acao={
        previa?.registros.length ? (
          <div className="flex items-center gap-3">
            <Botao onClick={gravar} disabled={gravando || erros.length > 0}>
              {gravando ? "Gravando…" : "Gravar no banco"}
            </Botao>
            {erros.length ? (
              <span className="text-xs text-critico">
                Corrija os erros na planilha antes de gravar.
              </span>
            ) : null}
          </div>
        ) : null
      }
    >
      {previa ? (
        <>
          <dl className="grid gap-3 sm:grid-cols-4">
            <Resumo rotulo="Registros" valor={String(previa.totalLinhas)} />
            <Resumo
              rotulo="Exercícios"
              valor={previa.anos.length ? previa.anos.join(", ") : "—"}
            />
            <Resumo rotulo="Planejado OSG" valor={moeda(totalAprop)} />
            <Resumo rotulo="Liquidado" valor={moeda(totalLiq)} />
          </dl>

          <Colunas esperadas={COLUNAS_OSG} encontradas={previa.colunasEncontradas} />
          <ListaAvisos avisos={[...previa.avisos, ...avisosQdd]} />

          <fieldset className="rounded-lg border border-borda p-4">
            <legend className="px-1 text-xs font-medium uppercase tracking-wide text-texto-3">
              Como gravar
            </legend>
            <div className="space-y-2.5">
              <Opcao
                nome="modo-osg"
                marcado={modo === "substituir"}
                aoMarcar={() => setModo("substituir")}
                titulo="Substituir exercício"
                descricao={`Apaga e regrava apenas ${previa.anos.join(" e ") || "os exercícios do arquivo"}. Os demais exercícios ficam intactos.`}
              />
              <Opcao
                nome="modo-osg"
                marcado={modo === "mesclar"}
                aoMarcar={() => setModo("mesclar")}
                titulo="Mesclar"
                descricao="Atualiza os registros já existentes e acrescenta os novos, sem apagar nada."
              />
            </div>
          </fieldset>
        </>
      ) : null}
    </BlocoImportacao>
  );
}

function ImportarLeis() {
  const [leis, setLeis] = useState<Lei[] | null>(null);
  const [porTipo, setPorTipo] = useState<Record<string, number>>({});
  const [gravando, setGravando] = useState(false);

  const ler = async (file: File) => {
    const r = parseHistoricoLeis(lerAbas(await file.arrayBuffer()));
    setLeis(r.leis);
    setPorTipo(r.porTipo);
    if (r.abasIgnoradas.length) {
      toast.warning(`Abas não encontradas: ${r.abasIgnoradas.join(", ")}.`);
    }
    if (!r.leis.length) {
      toast.error("Nenhum instrumento legal reconhecido.");
      return false;
    }
  };

  const gravar = async () => {
    if (!leis?.length) return;
    setGravando(true);
    try {
      const r = await fetch("/api/leis", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ leis }),
      });
      const dados = (await r.json()) as { erro?: string; gravados?: number };
      if (!r.ok) throw new Error(dados.erro ?? "Falha ao gravar.");
      toast.success(`${dados.gravados} instrumentos legais gravados.`);
      setLeis(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao gravar.");
    } finally {
      setGravando(false);
    }
  };

  const semLink = leis?.filter((l) => !l.url).length ?? 0;

  return (
    <BlocoImportacao
      icone={Gavel}
      titulo="Histórico de leis"
      descricao={
        <>
          Arquivo{" "}
          <code className="text-xs">
            HISTÓRICO DE LEIS ORÇAMENTO SENSÍVEL AO GÊNERO.xlsx
          </code>
          . O link do legis.ac.gov.br é lido do hyperlink embutido na célula do número —
          as colunas de valor da aba LOA são descartadas.
        </>
      }
      aoLer={ler}
      limpar={() => setLeis(null)}
      acao={
        leis?.length ? (
          <Botao onClick={gravar} disabled={gravando}>
            {gravando ? "Gravando…" : `Gravar ${leis.length} instrumentos`}
          </Botao>
        ) : null
      }
    >
      {leis ? (
        <>
          <ul className="flex flex-wrap gap-1.5">
            {Object.entries(porTipo).map(([tipo, n]) => (
              <li key={tipo}>
                <Etiqueta tom="lilas">
                  {ROTULO_TIPO[tipo as keyof typeof ROTULO_TIPO] ?? tipo}: {n}
                </Etiqueta>
              </li>
            ))}
          </ul>
          {semLink ? (
            <ListaAvisos
              avisos={[
                {
                  nivel: "aviso",
                  mensagem: `${semLink} instrumento(s) sem hyperlink na planilha. Vão aparecer no site sem o botão de texto integral.`,
                  linhas: [],
                },
              ]}
            />
          ) : null}
          <p className="text-xs leading-relaxed text-texto-3">
            A gravação substitui todo o histórico: a lista publicada passa a ser
            exatamente a da planilha enviada.
          </p>
        </>
      ) : null}
    </BlocoImportacao>
  );
}

/**
 * Relatório do sistema "Orçamentos Temáticos" — a fonte que deve substituir a
 * planilha manual a partir de 2026, já com a etiquetagem por orçamento temático,
 * a validação das entregas e a categoria.
 *
 * O layout ainda não foi definido, então este campo por enquanto só reconhece o
 * arquivo: mostra as abas, o cabeçalho e as primeiras linhas, e **não grava
 * nada**. É com essa leitura que o mapeamento vai ser escrito.
 */
function ImportarOrcamentosTematicos() {
  const [abas, setAbas] = useState<Aba[] | null>(null);

  const ler = async (file: File) => {
    const lidas = lerAbas(await file.arrayBuffer());
    setAbas(lidas);
    if (!lidas.length) {
      toast.error("Não consegui abrir o arquivo.");
      return false;
    }
    toast.info("Formato registrado na tela. Nada foi gravado no banco.");
  };

  return (
    <BlocoImportacao
      icone={LayoutList}
      titulo="Relatório Orçamentos Temáticos"
      descricao={
        <>
          Relatório do sistema em que o QDD do exercício é etiquetado por orçamento
          temático, com a validação das entregas e a categoria.{" "}
          <strong className="font-medium text-texto">
            Ainda em reconhecimento de formato:
          </strong>{" "}
          o arquivo é lido e exibido aqui, mas nada é gravado até o mapeamento das
          colunas ser definido.
        </>
      }
      aoLer={ler}
      limpar={() => setAbas(null)}
    >
      {abas ? (
        <div className="space-y-4">
          {abas.map((aba) => {
            const cabecalho =
              aba.linhas.findIndex(
                (l) => l.filter((c) => String(c ?? "").trim()).length >= 3
              ) ?? 0;
            const inicio = Math.max(0, cabecalho);
            return (
              <div key={aba.nome} className="rounded-lg border border-borda p-4">
                <h3 className="text-sm font-semibold text-texto">
                  Aba &ldquo;{aba.nome}&rdquo;
                </h3>
                <p className="mt-0.5 text-xs text-texto-3">
                  {aba.linhas.length} linhas · {aba.links.size} hyperlinks
                </p>
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <tbody>
                      {aba.linhas.slice(inicio, inicio + 6).map((linha, i) => (
                        <tr key={i} className="border-b border-borda last:border-0">
                          <td className="py-1 pr-3 text-texto-3">{inicio + i + 1}</td>
                          {linha.slice(0, 12).map((celula, j) => (
                            <td
                              key={j}
                              className="max-w-[16ch] truncate py-1 pr-3 text-texto-2"
                              title={String(celula ?? "")}
                            >
                              {String(celula ?? "")}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
          <p className="rounded-lg border border-alerta/40 bg-alerta/10 px-3 py-2 text-xs leading-relaxed text-texto-2">
            Nada foi gravado. Guarde uma cópia do arquivo em{" "}
            <code className="text-xs">_fontes/</code> para que o mapeamento das colunas
            seja escrito na próxima rodada.
          </p>
        </div>
      ) : null}
    </BlocoImportacao>
  );
}
