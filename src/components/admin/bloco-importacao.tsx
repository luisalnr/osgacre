"use client";

import { useRef, useState, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { AlertTriangle, Check, Upload, X } from "lucide-react";
import { toast } from "sonner";
import type { Aviso } from "@/lib/parser-osg";
import { Botao, Card } from "@/components/ui/primitivos";
import { cn } from "@/lib/utils";

/**
 * Moldura comum dos campos de importação: escolher arquivo, ler no navegador,
 * mostrar a prévia e só então gravar. A leitura acontece toda no cliente; para
 * o servidor vai apenas o JSON já conferido.
 */
export function BlocoImportacao({
  icone: Icone,
  titulo,
  descricao,
  aoLer,
  children,
  acao,
  limpar,
}: {
  icone: LucideIcon;
  titulo: string;
  descricao: ReactNode;
  /** Lê o arquivo escolhido. Devolver `false` mantém o nome fora da tela. */
  aoLer: (arquivo: File) => Promise<boolean | void>;
  /** Prévia — só aparece depois de uma leitura bem-sucedida. */
  children?: ReactNode;
  acao?: ReactNode;
  /** Chamado ao trocar de arquivo, para descartar a prévia anterior. */
  limpar?: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [arquivo, setArquivo] = useState<string | null>(null);
  const [lendo, setLendo] = useState(false);

  const escolher = async (f: File) => {
    limpar?.();
    setArquivo(null);
    setLendo(true);
    try {
      const ok = await aoLer(f);
      if (ok !== false) setArquivo(f.name);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não consegui ler o arquivo.");
    } finally {
      setLendo(false);
    }
  };

  return (
    <Card className="p-6">
      <header className="mb-5 flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-lilas-claro text-lilas">
          <Icone className="size-5" aria-hidden />
        </span>
        <div>
          <h2 className="text-base font-semibold text-texto">{titulo}</h2>
          <div className="mt-1 text-sm leading-relaxed text-texto-2">{descricao}</div>
        </div>
      </header>

      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void escolher(f);
        }}
      />

      <div className="flex flex-wrap items-center gap-3">
        <Botao
          variante="secundario"
          onClick={() => inputRef.current?.click()}
          disabled={lendo}
        >
          <Upload className="size-4" aria-hidden />
          {lendo ? "Lendo…" : "Escolher planilha"}
        </Botao>
        {arquivo ? (
          <span className="text-xs text-texto-2">{arquivo}</span>
        ) : (
          <span className="text-xs text-texto-3">Nenhum arquivo selecionado</span>
        )}
      </div>

      {children ? <div className="mt-6 space-y-5">{children}</div> : null}
      {acao ? <div className="mt-6">{acao}</div> : null}
    </Card>
  );
}

/** Cartão de número da prévia. */
export function Resumo({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="rounded-lg border border-borda bg-superficie-2/60 p-3">
      <dt className="text-xs font-medium uppercase tracking-wide text-texto-3">
        {rotulo}
      </dt>
      <dd className="tabular mt-1 text-sm font-semibold text-texto">{valor}</dd>
    </div>
  );
}

/** Lista de colunas esperadas, com o que a planilha trouxe. */
export function Colunas({
  esperadas,
  encontradas,
}: {
  esperadas: readonly string[];
  encontradas: Record<string, boolean>;
}) {
  return (
    <div>
      <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-texto-3">
        Colunas encontradas
      </h3>
      <ul className="flex flex-wrap gap-1.5">
        {esperadas.map((c) => {
          const ok = encontradas[c];
          return (
            <li key={c}>
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs",
                  ok ? "bg-verde/10 text-verde" : "bg-critico/10 text-critico"
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
  );
}

export function ListaAvisos({ avisos }: { avisos: Aviso[] }) {
  if (!avisos.length) {
    return (
      <p className="rounded-lg border border-verde/30 bg-verde/10 px-3 py-2 text-xs text-verde">
        Nenhuma inconsistência encontrada.
      </p>
    );
  }
  return (
    <ul className="space-y-2">
      {avisos.map((a, i) => (
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
  );
}

/** Radio de modo de gravação. */
export function Opcao({
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
        <span className="block text-xs leading-relaxed text-texto-2">{descricao}</span>
      </span>
    </label>
  );
}
