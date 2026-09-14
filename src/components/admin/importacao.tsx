"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, LayoutList, LogOut, Table2 } from "lucide-react";
import { toast } from "sonner";
import { lerAbas } from "@/lib/xlsx-io";
import { COLUNAS_QDD, parseQdd, type ResultadoQdd } from "@/lib/parser-qdd";
import {
  COLUNAS_OT,
  parseOrcamentosTematicos,
  type ResultadoOT,
} from "@/lib/parser-orcamentos-tematicos";
import type { DotacaoQdd } from "@/lib/types";
import {
  CATEGORIAS_ECONOMICAS,
  ELEMENTOS_DESPESA,
  FONTES,
  GRUPOS_NATUREZA,
  MODALIDADES_APLICACAO,
} from "@/lib/tabelas";
import {
  catEconomicaDe,
  elementoDe,
  gndDe,
  modalidadeDe,
} from "@/lib/referencias";
import { inteiro, moeda } from "@/lib/formato";
import { Botao, Entrada } from "@/components/ui/primitivos";
import {
  BlocoImportacao,
  Colunas,
  ListaAvisos,
  Opcao,
  Resumo,
} from "./bloco-importacao";

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
          A Tabela OSG e o histórico de leis não são importados por aqui: os
          exercícios de 2024 e 2025 já estão carregados, e a partir de 2026 a fonte é
          o{" "}
          <strong className="font-medium text-texto">
            Relatório Orçamentos Temáticos
          </strong>
          , no fim da página. O QDD continua sendo importado normalmente — é dele que
          vêm a dotação de cada ação orçamentária e as fontes de recurso.
        </p>

        <ImportarQdd />
        <ImportarOrcamentosTematicos />
      </main>
    </div>
  );
}

/** Quantas linhas por requisição. Ver o comentário em `gravar`. */
const FATIA = 2000;

/**
 * Importação do QDD — Quadro de Detalhamento da Despesa.
 *
 * O arquivo é lido no navegador e gravado na granularidade do relatório, uma
 * linha por conta de despesa e fonte: são de 6 a 9 mil por exercício, e é delas que
 * saem a fonte de recurso e a classificação da despesa que a tabela detalhada e
 * a planilha de exportação mostram.
 */
function ImportarQdd() {
  const router = useRouter();
  const [r, setR] = useState<ResultadoQdd | null>(null);
  const [ano, setAno] = useState("");
  const [gravando, setGravando] = useState(false);
  const [progresso, setProgresso] = useState(0);

  const ler = async (file: File) => {
    const abas = lerAbas(await file.arrayBuffer());
    if (!abas.length) {
      toast.error("Não consegui abrir o arquivo.");
      return false;
    }
    // O exercício mora no cabeçalho do relatório ("Exercício: 2025"), não numa
    // coluna. Quando não vem, o nome do arquivo é a rede de segurança — e se nem
    // ele tiver, o campo abaixo pergunta.
    const lido = parseQdd(abas[0].linhas);
    const doNome = Number(file.name.match(/(\d{4})/)?.[1]);
    const final =
      lido.anos[0] || !doNome ? lido : parseQdd(abas[0].linhas, doNome);

    setR(final);
    setAno(final.anos[0] ? String(final.anos[0]) : "");
    if (!final.dotacoes.length) {
      toast.error("Nenhuma dotação reconhecida no arquivo.");
      return false;
    }
    return true;
  };

  const limpar = () => {
    setR(null);
    setAno("");
    setProgresso(0);
  };

  const exercicio = Number(ano);

  /**
   * Grava em fatias.
   *
   * Um exercício passa de 4 MB de JSON, acima do teto de corpo de requisição da
   * hospedagem — numa requisição só, a importação falharia no ar depois de
   * funcionar na máquina de quem desenvolve. Só a primeira fatia manda
   * `substituir`, porque é ela que apaga o exercício antigo; se todas mandassem,
   * cada uma limparia a anterior e sobraria apenas a última.
   */
  const gravar = async () => {
    if (!r || !exercicio) return;
    const linhas = r.dotacoes.map((d) => ({ ...d, ano: exercicio }));
    setGravando(true);
    setProgresso(0);
    try {
      for (let i = 0; i < linhas.length; i += FATIA) {
        const resp = await fetch("/api/qdd", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            qdd: linhas.slice(i, i + FATIA),
            substituir: i === 0,
          }),
        });
        if (!resp.ok) {
          const corpo = await resp.json().catch(() => ({}));
          throw new Error(corpo.erro ?? `Falha ao gravar (HTTP ${resp.status}).`);
        }
        setProgresso(Math.min(i + FATIA, linhas.length));
      }
      toast.success(
        `QDD de ${exercicio} gravado: ${inteiro(linhas.length)} linhas.`
      );
      limpar();
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não consegui gravar o QDD.");
    } finally {
      setGravando(false);
    }
  };

  return (
    <BlocoImportacao
      icone={Table2}
      titulo="QDD — Quadro de Detalhamento da Despesa"
      descricao={
        <>
          Relatório mensal de saldo disponível, em <code className="text-xs">.xls</code>.
          É a origem da dotação inicial e da atualizada de cada ação orçamentária —
          base do percentual de participação do OSG — e das fontes de recurso.{" "}
          <strong className="font-medium text-texto">
            A gravação substitui integralmente os exercícios do arquivo:
          </strong>{" "}
          o QDD é um retrato completo, e uma dotação anulada precisa sumir.
        </>
      }
      aoLer={ler}
      limpar={limpar}
      acao={
        r ? (
          <div className="flex flex-wrap items-center gap-3">
            <Botao onClick={gravar} disabled={gravando || !exercicio}>
              {gravando
                ? `Gravando… ${inteiro(progresso)}/${inteiro(r.dotacoes.length)}`
                : "Gravar no banco"}
            </Botao>
            {!exercicio ? (
              <span className="text-xs text-critico">
                Informe o exercício antes de gravar.
              </span>
            ) : null}
          </div>
        ) : null
      }
    >
      {r ? (
        <>
          <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Resumo rotulo="Linhas contábeis" valor={inteiro(r.linhasContabeis)} />
            <Resumo rotulo="Linhas a gravar" valor={inteiro(r.dotacoes.length)} />
            <Resumo rotulo="Dotações" valor={inteiro(r.dotacoesDistintas)} />
            <Resumo rotulo="Fontes de recurso" valor={inteiro(r.fontes.length)} />
          </dl>

          {/* O exercício vem do cabeçalho do relatório; quando não vem, é aqui
              que ele entra — sem ele a gravação não sabe o que substituir. */}
          <label className="flex flex-wrap items-center gap-3 text-sm text-texto-2">
            Exercício
            <Entrada
              value={ano}
              onChange={(e) => setAno(e.target.value.replace(/\D/g, "").slice(0, 4))}
              className="w-28"
              inputMode="numeric"
              placeholder="AAAA"
            />
            {r.anos[0] ? (
              <span className="text-xs text-texto-3">
                lido do cabeçalho do relatório
              </span>
            ) : (
              <span className="text-xs text-alerta">
                não encontrei no arquivo — confira antes de gravar
              </span>
            )}
          </label>

          <Colunas esperadas={COLUNAS_QDD} encontradas={r.colunasEncontradas} />
          <CodigosDesconhecidos resultado={r} />
          <ListaAvisos
            avisos={r.avisos.map((mensagem) => ({
              nivel: "aviso" as const,
              mensagem,
              linhas: [],
            }))}
          />
        </>
      ) : null}
    </BlocoImportacao>
  );
}

/**
 * Códigos do arquivo que não existem nas tabelas oficiais do `TABELAS.xlsx`.
 *
 * Os rótulos do painel caem para o código nu quando não conhecem um código, o
 * que é o comportamento certo na tela — mas faz o problema passar despercebido.
 * Aqui, na hora da importação, ele aparece para quem pode corrigir: ou o QDD
 * trouxe um código torto, ou a tabela de referência envelheceu e precisa ser
 * regerada com `npm run data:tabelas`.
 */
function CodigosDesconhecidos({ resultado }: { resultado: ResultadoQdd }) {
  const faltantes = (
    valores: string[],
    tabela: Record<string, string>
  ): string[] => [...new Set(valores.filter((v) => v && !tabela[v]))].sort();

  const contas = resultado.dotacoes.map((d) => d.contaDespesa);
  const grupos: { rotulo: string; codigos: string[] }[] = [
    { rotulo: "Fonte de recurso", codigos: faltantes(resultado.fontes, FONTES) },
    {
      rotulo: "Categoria econômica",
      codigos: faltantes(contas.map(catEconomicaDe), CATEGORIAS_ECONOMICAS),
    },
    {
      rotulo: "Grupo de natureza",
      codigos: faltantes(contas.map(gndDe), GRUPOS_NATUREZA),
    },
    {
      rotulo: "Modalidade",
      codigos: faltantes(contas.map(modalidadeDe), MODALIDADES_APLICACAO),
    },
    {
      rotulo: "Elemento de despesa",
      codigos: faltantes(contas.map(elementoDe), ELEMENTOS_DESPESA),
    },
  ].filter((g) => g.codigos.length);

  if (!grupos.length) {
    return (
      <p className="rounded-lg border border-verde/30 bg-verde/10 px-3 py-2 text-xs text-verde">
        Todos os códigos de classificação do arquivo constam das tabelas oficiais.
      </p>
    );
  }

  return (
    <div className="rounded-lg border border-alerta/40 bg-alerta/10 px-3 py-2.5">
      <h3 className="text-xs font-medium text-texto-2">
        Códigos fora das tabelas oficiais
      </h3>
      <p className="mt-0.5 text-xs leading-relaxed text-texto-3">
        Serão gravados e aparecerão sem descrição, só com o código. Confira se é
        erro do arquivo ou tabela de referência desatualizada.
      </p>
      <ul className="mt-2 space-y-1.5">
        {grupos.map((g) => (
          <li key={g.rotulo} className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className="text-xs font-medium text-texto-2">{g.rotulo}:</span>
            {g.codigos.map((c) => (
              <span
                key={c}
                className="tabular rounded bg-critico/10 px-1.5 py-0.5 text-xs text-critico"
              >
                {c}
              </span>
            ))}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Relatório do Sistema de Orçamentos Temáticos — a fonte dos registros do OSG a
 * partir de 2026, no lugar da planilha manual `Tabela_OSG`.
 *
 * Importe o QDD do exercício ANTES deste arquivo. Não é obrigatório, e a
 * gravação não é bloqueada por isso, mas é o QDD que nomeia órgão e unidade com
 * a grafia canônica — a mesma de 2024 e 2025 — e que dá a dotação contra a qual
 * a participação do OSG é calculada. Sem ele os registros entram com os nomes
 * como o relatório os escreve, e o painel fica sem percentual e sem fontes de
 * recurso até o QDD chegar.
 */
function ImportarOrcamentosTematicos() {
  const router = useRouter();
  const [r, setR] = useState<ResultadoOT | null>(null);
  const [modo, setModo] = useState<"substituir" | "mesclar">("substituir");
  const [gravando, setGravando] = useState(false);

  const ler = async (file: File) => {
    const abas = lerAbas(await file.arrayBuffer());
    if (!abas.length) {
      toast.error("Não consegui abrir o arquivo.");
      return false;
    }
    const alvo =
      abas.find((a) => a.nome.trim().toLowerCase() === "resultados") ?? abas[0];

    // O QDD do exercício é buscado no banco, e não pedido de novo: quem acabou
    // de importá-lo não deveria ter de anexá-lo outra vez. Só serve para nomear
    // e conferir, então falha de rede aqui não impede a leitura.
    const previa = parseOrcamentosTematicos(alvo.linhas);
    let qdd: DotacaoQdd[] = [];
    if (previa.anos.length) {
      try {
        const resp = await fetch(`/api/qdd?anos=${previa.anos.join(",")}`);
        if (resp.ok) qdd = ((await resp.json()) as { qdd?: DotacaoQdd[] }).qdd ?? [];
      } catch {
        // Segue sem o QDD; o parser emite o aviso correspondente.
      }
    }

    const lido = qdd.length ? parseOrcamentosTematicos(alvo.linhas, qdd) : previa;
    setR(lido);
    if (!lido.registros.length) {
      toast.error("Nenhum registro reconhecido no arquivo.");
      return false;
    }
    return true;
  };

  const limpar = () => {
    setR(null);
    setModo("substituir");
  };

  const temErro = r?.avisos.some((a) => a.nivel === "erro") ?? false;

  const gravar = async () => {
    if (!r || temErro) return;
    setGravando(true);
    try {
      const resp = await fetch("/api/registros", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ registros: r.registros, modo }),
      });
      if (!resp.ok) {
        const corpo = await resp.json().catch(() => ({}));
        throw new Error(corpo.erro ?? `Falha ao gravar (HTTP ${resp.status}).`);
      }
      toast.success(
        `${inteiro(r.registros.length)} entregas gravadas em ${r.anos.join(", ")}.`
      );
      limpar();
      router.refresh();
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Não consegui gravar os registros."
      );
    } finally {
      setGravando(false);
    }
  };

  return (
    <BlocoImportacao
      icone={LayoutList}
      titulo="Relatório Orçamentos Temáticos"
      descricao={
        <>
          Relatório do sistema em que o QDD do exercício é etiquetado por orçamento
          temático, com a validação das entregas e a categoria. É a fonte dos
          registros do OSG a partir de 2026.{" "}
          <strong className="font-medium text-texto">
            Importe o QDD do exercício antes, e reimporte este relatório sempre que
            atualizar o QDD:
          </strong>{" "}
          é dele que vêm os nomes canônicos de órgão e unidade, a dotação sobre a
          qual a participação do OSG é calculada e o valor das emendas
          parlamentares, que o relatório reporta como zero.
        </>
      }
      aoLer={ler}
      limpar={limpar}
      acao={
        r ? (
          <div className="flex flex-wrap items-center gap-3">
            <Botao onClick={gravar} disabled={gravando || temErro}>
              {gravando ? "Gravando…" : "Gravar no banco"}
            </Botao>
            {temErro ? (
              <span className="text-xs text-critico">
                Corrija os erros no arquivo antes de gravar.
              </span>
            ) : null}
          </div>
        ) : null
      }
    >
      {r ? (
        <>
          <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Resumo rotulo="Exercício" valor={r.anos.join(", ") || "—"} />
            <Resumo rotulo="Dotações" valor={inteiro(r.dotacoes)} />
            <Resumo rotulo="Entregas" valor={inteiro(r.registros.length)} />
            <Resumo rotulo="Planejado do OSG" valor={moeda(r.totalPlanejado)} />
          </dl>

          <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Resumo
              rotulo="Dotações casadas com o QDD"
              valor={`${inteiro(r.casadasComQdd)} de ${inteiro(r.dotacoes)}`}
            />
            <Resumo rotulo="Ciclo" valor={r.ciclos.join(", ") || "—"} />
            {/*
              Emenda parlamentar entra na LOA zerada, então o relatório a reporta
              como zero e o valor vem da dotação atualizada do QDD. Como o QDD é
              um retrato que muda ao longo do exercício, estes dois números são o
              que se confere depois de cada atualização dele.
            */}
            <Resumo rotulo="Emendas pela dotação atualizada" valor={inteiro(r.emendasDerivadas)} />
            <Resumo rotulo="Valor recuperado das emendas" valor={moeda(r.totalDerivado)} />
          </dl>

          {/*
            O liquidado é gravado mas não aparece no painel enquanto o exercício
            não fecha. Mostrá-lo aqui, e só aqui, é o que permite a quem importa
            conferir o arquivo contra o sistema de origem sem que o número vire
            leitura pública antes da hora.
          */}
          <p className="rounded-lg border border-borda bg-superficie-2 px-3 py-2 text-xs leading-relaxed text-texto-2">
            <strong className="font-medium text-texto">
              Liquidado no arquivo: {moeda(r.totalLiquidado)}.
            </strong>{" "}
            É gravado no banco para conferência, mas o painel não o exibe enquanto
            a execução do exercício não for encerrada — ver{" "}
            <code className="text-xs">EXERCICIOS_EM_APURACAO</code> em{" "}
            <code className="text-xs">referencias.ts</code>.
          </p>

          <Colunas esperadas={COLUNAS_OT} encontradas={r.colunasEncontradas} />

          <ListaAvisos avisos={r.avisos} />

          <div className="space-y-2.5 rounded-lg border border-borda p-4">
            <Opcao
              nome="modo-ot"
              marcado={modo === "substituir"}
              aoMarcar={() => setModo("substituir")}
              titulo="Substituir o exercício"
              descricao="Apaga os registros dos exercícios presentes no arquivo e grava estes no lugar. Os demais exercícios não são tocados."
            />
            <Opcao
              nome="modo-ot"
              marcado={modo === "mesclar"}
              aoMarcar={() => setModo("mesclar")}
              titulo="Mesclar"
              descricao="Atualiza os registros que já existem e acrescenta os novos, sem apagar nada. Uma entrega retirada do relatório continua no banco."
            />
          </div>
        </>
      ) : null}
    </BlocoImportacao>
  );
}
