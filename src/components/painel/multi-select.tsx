"use client";

import { Popover } from "radix-ui";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export type OpcaoMulti = { valor: string; rotulo: string };

/**
 * Seleção múltipla em popover. Vazio significa "todos" — é o padrão do painel e
 * evita o estado ruim de "nenhum selecionado, tela em branco".
 */
export function MultiSelect({
  rotulo,
  opcoes,
  selecionados,
  aoMudar,
  className,
}: {
  rotulo: string;
  opcoes: OpcaoMulti[];
  selecionados: string[];
  aoMudar: (valores: string[]) => void;
  className?: string;
}) {
  const resumo =
    selecionados.length === 0
      ? "Todos"
      : selecionados.length === 1
        ? (opcoes.find((o) => o.valor === selecionados[0])?.rotulo ?? "1 selecionado")
        : `${selecionados.length} selecionados`;

  const alternar = (valor: string) => {
    aoMudar(
      selecionados.includes(valor)
        ? selecionados.filter((v) => v !== valor)
        : [...selecionados, valor]
    );
  };

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <span className="text-xs font-medium uppercase tracking-wide text-texto-3">
        {rotulo}
      </span>
      <Popover.Root>
        <Popover.Trigger asChild>
          <button
            type="button"
            className="flex h-10 w-full items-center justify-between gap-2 rounded-lg border border-borda-forte bg-superficie px-3 text-sm text-texto"
          >
            <span className="truncate">{resumo}</span>
            <ChevronDown className="size-4 shrink-0 text-texto-3" aria-hidden />
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            align="start"
            sideOffset={6}
            className="z-50 max-h-72 w-[var(--radix-popover-trigger-width)] min-w-56 overflow-y-auto rounded-lg border border-borda bg-superficie p-1 shadow-card-alta"
          >
            <div className="flex items-center justify-between gap-2 border-b border-borda px-2 py-1.5">
              <button
                type="button"
                onClick={() => aoMudar(opcoes.map((o) => o.valor))}
                className="text-xs font-medium text-lilas hover:underline"
              >
                Selecionar tudo
              </button>
              <button
                type="button"
                onClick={() => aoMudar([])}
                className="text-xs font-medium text-texto-3 hover:text-texto"
              >
                Limpar
              </button>
            </div>
            <ul className="py-1">
              {opcoes.map((o) => {
                const marcado = selecionados.includes(o.valor);
                return (
                  <li key={o.valor}>
                    <button
                      type="button"
                      onClick={() => alternar(o.valor)}
                      aria-pressed={marcado}
                      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-texto hover:bg-superficie-2"
                    >
                      <span
                        className={cn(
                          "flex size-4 shrink-0 items-center justify-center rounded border",
                          marcado
                            ? "border-lilas bg-lilas text-white"
                            : "border-borda-forte"
                        )}
                        aria-hidden
                      >
                        {marcado ? <Check className="size-3" /> : null}
                      </span>
                      <span className="truncate">{o.rotulo}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
}
