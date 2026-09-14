import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Primitivos de UI do projeto. São poucos e simples de propósito: o site tem
 * duas telas públicas e uma de administração, e uma biblioteca inteira de
 * componentes seria peso morto.
 */

export function Card({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-card border border-borda bg-superficie shadow-card",
        className
      )}
      {...props}
    />
  );
}

/**
 * Faixa central de todas as telas — site e painel.
 *
 * Mora num lugar só porque as faixas precisam concordar entre si: no painel a
 * barra de filtros é sticky, e no site o cabeçalho é fixo sobre o hero. Qualquer
 * divergência vira desalinho permanente durante a rolagem.
 *
 * **Alargar isto não basta sozinho.** Blocos de texto corrido precisam do próprio
 * teto (`max-w-3xl` e afins), senão as linhas passam dos ~75 caracteres legíveis.
 * Quem tem grade de cartões pode ocupar a faixa inteira.
 */
export const LARGURA_CONTEUDO = "mx-auto w-full max-w-[110rem] px-5 sm:px-8";

export function Secao({
  id,
  className,
  children,
}: {
  id?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className={cn("py-16 sm:py-24", className)}>
      <div className={LARGURA_CONTEUDO}>{children}</div>
    </section>
  );
}

export function TituloSecao({
  sobretitulo,
  titulo,
  descricao,
}: {
  sobretitulo?: React.ReactNode;
  titulo: string;
  descricao?: string;
}) {
  return (
    <header className="mb-10">
      {sobretitulo ? (
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-lilas">
          {sobretitulo}
        </p>
      ) : null}
      <h2 className="text-balance text-3xl font-semibold tracking-tight text-texto sm:text-4xl">
        {titulo}
      </h2>
      {/* Sem teto de largura: o texto corre até a borda da faixa de conteúdo,
          como o cabeçalho de seção do painel. As descrições daqui têm duas
          frases no máximo, e o `max-w-3xl` de antes as quebrava no meio
          deixando meia tela vazia à direita. Nada de `whitespace-nowrap` — em
          tela estreita a quebra é bem-vinda. */}
      {descricao ? (
        <p className="mt-4 text-pretty text-base leading-relaxed text-texto-2">
          {descricao}
        </p>
      ) : null}
    </header>
  );
}

type BotaoProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: "primario" | "secundario" | "fantasma" | "perigo";
  tamanho?: "md" | "sm";
};

const VARIANTES: Record<NonNullable<BotaoProps["variante"]>, string> = {
  primario:
    "bg-verde text-white hover:bg-verde-claro disabled:bg-borda-forte disabled:text-texto-3",
  secundario:
    "border border-borda-forte bg-superficie text-texto hover:bg-superficie-2",
  fantasma: "text-texto-2 hover:bg-superficie-2 hover:text-texto",
  perigo: "bg-critico text-white hover:opacity-90",
};

export function Botao({
  className,
  variante = "primario",
  tamanho = "md",
  ...props
}: BotaoProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors disabled:cursor-not-allowed",
        tamanho === "sm" ? "h-8 px-3 text-sm" : "h-10 px-4 text-sm",
        VARIANTES[variante],
        className
      )}
      {...props}
    />
  );
}

export function Etiqueta({
  className,
  tom = "neutro",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & {
  tom?: "neutro" | "lilas" | "verde" | "alerta";
}) {
  const tons = {
    neutro: "bg-superficie-2 text-texto-2",
    lilas: "bg-lilas-claro text-lilas",
    verde: "bg-verde/10 text-verde",
    alerta: "bg-alerta/15 text-texto",
  } as const;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium",
        tons[tom],
        className
      )}
      {...props}
    />
  );
}

export function Campo({
  rotulo,
  dica,
  children,
  className,
}: {
  rotulo: string;
  dica?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("flex flex-col gap-1.5", className)}>
      <span className="text-xs font-medium uppercase tracking-wide text-texto-3">
        {rotulo}
      </span>
      {children}
      {dica ? <span className="text-xs text-texto-3">{dica}</span> : null}
    </label>
  );
}

export const Entrada = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(function Entrada({ className, ...props }, ref) {
  return (
    <input
      ref={ref}
      className={cn(
        "h-10 w-full rounded-lg border border-borda-forte bg-superficie px-3 text-sm text-texto",
        "placeholder:text-texto-3 disabled:opacity-60",
        className
      )}
      {...props}
    />
  );
});

export function Divisor({ className }: { className?: string }) {
  return <hr className={cn("border-t border-borda", className)} />;
}

/** Barra de progresso usada nos KPIs e no percentual de execução. */
export function Barra({
  valor,
  cor = "var(--verde)",
  className,
}: {
  valor: number;
  cor?: string;
  className?: string;
}) {
  const pct = Math.max(0, Math.min(100, valor));
  return (
    <div
      className={cn("h-1.5 w-full overflow-hidden rounded-full bg-superficie-2", className)}
      role="presentation"
    >
      <div
        className="h-full rounded-full transition-[width] duration-500"
        style={{ width: `${pct}%`, background: cor }}
      />
    </div>
  );
}
