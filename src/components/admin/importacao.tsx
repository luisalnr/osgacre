"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  FileSpreadsheet,
  Gavel,
  LogOut,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { moeda } from "@/lib/formato";
import { parseHistoricoLeis, ROTULO_TIPO } from "@/lib/parser-leis";
import { COLUNAS_OSG, parseTabelaOSG, type ResultadoOSG } from "@/lib/parser-osg";
import type { Lei } from "@/lib/types";
import { lerAbas } from "@/lib/xlsx-io";
import { Botao, Card, Etiqueta } from "@/components/ui/primitivos";
import { cn } from "@/lib/utils";

type Modo = "substituir" | "mesclar";

/**
 * Aba de importação. A planilha é lida no navegador; para o servidor vai só o
 * JSON já validado. Assim a prévia é instantânea e a rota de gravação continua
 * simples — e protegida por sessão.
 */
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
            <span className="text-xs text-white/70">{usuario.nome || usuario.email}</span>
            <Botao variante="secundario" tamanho="sm" onClick={sair}>
              <LogOut className="size-3.5" aria-hidden />
              Sair
            </Botao>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl space-y-6 px-5 py-8 sm:px-8">
        <ImportarOSG />
        <ImportarLeis />
      </main>
    </div>
  );
}

function ImportarOSG() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [arquivo, setArquivo] = useState<string | null>(null);
  const [previa, setPrevia] = useState<ResultadoOSG | null>(null);
  const [modo, setModo] = useState<Modo>("substituir");
  const [gravando, setGravando] = useState(false);

  const aoEscolher = async (file: File) => {
    try {
      const abas = lerAbas(await file.arrayBuffer());
      const alvo =
        abas.find((a) => a.nome.trim().toLowerCase() === "tabela_osg") ?? abas[0];
      if (!alvo) {
        toast.error("A planilha não tem nenhuma aba legível.");
        return;
      }
      const r = parseTabelaOSG(alvo.linhas);
      setArquivo(`${file.name} — aba "${alvo.nome}"`);
      setPrevia(r);
      if (!r.registros.length) toast.error("Nenhuma linha reconhecida na planilha.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não consegui ler o arquivo.");
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
      setArquivo(null);
      if (inputRef.current) inputRef.current.value = "";
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
    <Card className="p-6">
      <header className="mb-5 flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-lilas-claro text-lilas">
          <FileSpreadsheet className="size-5" aria-hidden />
        </span>
        <div>
          <h2 className="text-base font-semibold text-texto">Tabela OSG</h2>
          <p className="mt-1 text-sm leading-relaxed text-texto-2">
            Arquivo <code className="text-xs">OSG TOTAL.xlsx</code>, aba{" "}
            <code className="text-xs">Tabela_OSG</code>. Uma linha por entrega
            apropriada.
          </p>
        </div>
      </header>

      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void aoEscolher(f);
        }}
      />

      <div className="flex flex-wrap items-center gap-3">
        <Botao variante="secundario" onClick={() => inputRef.current?.click()}>
          <Upload className="size-4" aria-hidden />
          Escolher planilha
        </Botao>
        {arquivo ? (
          <span className="text-xs text-texto-2">{arquivo}</span>
        ) : (
          <span className="text-xs text-texto-3">Nenhum arquivo selecionado</span>
        )}
      </div>

      {previa ? (
        <div className="mt-6 space-y-5">
          <dl className="grid gap-3 sm:grid-cols-4">
            <Resumo rotulo="Registros" valor={String(previa.totalLinhas)} />
            <Resumo
              rotulo="Exercícios"
              valor={previa.anos.length ? previa.anos.join(", ") : "—"}
            />
            <Resumo rotulo="Apropriado" valor={moeda(totalAprop)} />
            <Resumo rotulo="Liquidado" valor={moeda(totalLiq)} />
          </dl>

          <div>
            <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-texto-3">
              Colunas encontradas
            </h3>
            <ul className="flex flex-wrap gap-1.5">
              {COLUNAS_OSG.map((c) => {
                const ok = previa.colunasEncontradas[c];
                return (
                  <li key={c}>
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs",
                        ok
                          ? "bg-verde/10 text-verde"
                          : "bg-critico/10 text-critico"
                      )}
                    >
                      {ok ? <Check className="size-3" /> : <X className="size-3" />}
                      {c}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>

          {previa.avisos.length ? (
            <ul className="space-y-2">
              {previa.avisos.map((a, i) => (
                <li
                  key={i}
                  className={cn(
                    "flex items-start gap-2 rounded-lg border px-3 py-2 text-xs leading-relaxed",
                    a.nivel === "erro"
                      ? "border-critico/30 bg-critico/10 text-critico"
                      : "border-alerta/40 bg-alerta/10 text-texto-2"
                  )}
                >
                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                  <span>
                    {a.mensagem}
                    {a.linhas.length ? (
                      <span className="text-texto-3">
                        {" "}
                        Linhas: {a.linhas.slice(0, 20).join(", ")}
                        {a.linhas.length > 20 ? ` e mais ${a.linhas.length - 20}` : ""}.
                      </span>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-lg border border-verde/30 bg-verde/10 px-3 py-2 text-xs text-verde">
              Nenhuma inconsistência encontrada.
            </p>
          )}

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

          <div className="flex items-center gap-3">
            <Botao
              onClick={gravar}
              disabled={gravando || !previa.registros.length || erros.length > 0}
            >
              {gravando ? "Gravando…" : "Gravar no banco"}
            </Botao>
            {erros.length ? (
              <span className="text-xs text-critico">
                Corrija os erros na planilha antes de gravar.
              </span>
            ) : null}
          </div>
        </div>
      ) : null}
    </Card>
  );
}

function ImportarLeis() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [arquivo, setArquivo] = useState<string | null>(null);
  const [leis, setLeis] = useState<Lei[] | null>(null);
  const [porTipo, setPorTipo] = useState<Record<string, number>>({});
  const [gravando, setGravando] = useState(false);

  const aoEscolher = async (file: File) => {
    try {
      const r = parseHistoricoLeis(lerAbas(await file.arrayBuffer()));
      setArquivo(file.name);
      setLeis(r.leis);
      setPorTipo(r.porTipo);
      if (r.abasIgnoradas.length) {
        toast.warning(`Abas não encontradas: ${r.abasIgnoradas.join(", ")}.`);
      }
      if (!r.leis.length) toast.error("Nenhum instrumento legal reconhecido.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não consegui ler o arquivo.");
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
      setArquivo(null);
      if (inputRef.current) inputRef.current.value = "";
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao gravar.");
    } finally {
      setGravando(false);
    }
  };

  const semLink = leis?.filter((l) => !l.url).length ?? 0;

  return (
    <Card className="p-6">
      <header className="mb-5 flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-lilas-claro text-lilas">
          <Gavel className="size-5" aria-hidden />
        </span>
        <div>
          <h2 className="text-base font-semibold text-texto">Histórico de leis</h2>
          <p className="mt-1 text-sm leading-relaxed text-texto-2">
            Arquivo{" "}
            <code className="text-xs">
              HISTÓRICO DE LEIS ORÇAMENTO SENSÍVEL AO GÊNERO.xlsx
            </code>
            . O link do legis.ac.gov.br é lido do hyperlink embutido na célula do
            número — as colunas de valor da aba LOA são descartadas.
          </p>
        </div>
      </header>

      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void aoEscolher(f);
        }}
      />

      <div className="flex flex-wrap items-center gap-3">
        <Botao variante="secundario" onClick={() => inputRef.current?.click()}>
          <Upload className="size-4" aria-hidden />
          Escolher planilha
        </Botao>
        {arquivo ? (
          <span className="text-xs text-texto-2">{arquivo}</span>
        ) : (
          <span className="text-xs text-texto-3">Nenhum arquivo selecionado</span>
        )}
      </div>

      {leis ? (
        <div className="mt-6 space-y-5">
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
            <p className="flex items-start gap-2 rounded-lg border border-alerta/40 bg-alerta/10 px-3 py-2 text-xs leading-relaxed text-texto-2">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              {semLink} instrumento(s) sem hyperlink na planilha. Vão aparecer no
              site sem o botão de texto integral.
            </p>
          ) : null}

          <p className="text-xs leading-relaxed text-texto-3">
            A gravação substitui todo o histórico: a lista publicada passa a ser
            exatamente a da planilha enviada.
          </p>

          <Botao onClick={gravar} disabled={gravando || !leis.length}>
            {gravando ? "Gravando…" : `Gravar ${leis.length} instrumentos`}
          </Botao>
        </div>
      ) : null}
    </Card>
  );
}

function Resumo({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="rounded-lg border border-borda bg-superficie-2/60 p-3">
      <dt className="text-xs font-medium uppercase tracking-wide text-texto-3">
        {rotulo}
      </dt>
      <dd className="tabular mt-1 text-sm font-semibold text-texto">{valor}</dd>
    </div>
  );
}

function Opcao({
  nome,
  marcado,
  aoMarcar,
  titulo,
  descricao,
}: {
  nome: string;
  marcado: boolean;
  aoMarcar: () => void;
  titulo: string;
  descricao: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5">
      <input
        type="radio"
        name={nome}
        checked={marcado}
        onChange={aoMarcar}
        className="mt-1 accent-[var(--lilas)]"
      />
      <span>
        <span className="block text-sm font-medium text-texto">{titulo}</span>
        <span className="block text-xs leading-relaxed text-texto-2">
          {descricao}
        </span>
      </span>
    </label>
  );
}
