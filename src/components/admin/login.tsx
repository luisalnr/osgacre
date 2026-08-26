"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, Lock } from "lucide-react";
import { Botao, Campo, Card, Entrada } from "@/components/ui/primitivos";

export function Login() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const submeter = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      const r = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, senha }),
      });
      const dados = (await r.json()) as { erro?: string };
      if (!r.ok) {
        setErro(dados.erro ?? "Não foi possível entrar.");
        return;
      }
      // O servidor decide o que renderizar; basta pedir um novo render.
      router.refresh();
    } catch {
      setErro("Falha de rede. Tente novamente.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-verde-escuro px-5 py-16">
      <div className="w-full max-w-sm">
        <Link
          href="/"
          className="mb-6 inline-flex items-center gap-1.5 text-xs text-white/70 hover:text-white"
        >
          <ArrowLeft className="size-3.5" aria-hidden />
          Voltar ao site
        </Link>

        <Card className="p-7">
          <Image
            src="/logos/seplan-horizontal-verde.png"
            alt="SEPLAN"
            width={420}
            height={120}
            className="mb-6 h-9 w-auto dark:hidden"
          />
          <Image
            src="/logos/seplan-horizontal-branco.png"
            alt="SEPLAN"
            width={420}
            height={120}
            className="mb-6 hidden h-9 w-auto dark:block"
          />

          <h1 className="flex items-center gap-2 text-lg font-semibold text-texto">
            <Lock className="size-4 text-lilas" aria-hidden />
            Área restrita
          </h1>
          <p className="mt-1.5 text-sm leading-relaxed text-texto-2">
            Importação da planilha do OSG e do histórico de leis para o banco de
            dados do painel.
          </p>

          <form onSubmit={submeter} className="mt-6 space-y-4">
            <Campo rotulo="E-mail">
              <Entrada
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="username"
                required
              />
            </Campo>
            <Campo rotulo="Senha">
              <Entrada
                type="password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                autoComplete="current-password"
                required
              />
            </Campo>

            {erro ? (
              <p
                role="alert"
                className="rounded-lg border border-critico/30 bg-critico/10 px-3 py-2 text-sm text-critico"
              >
                {erro}
              </p>
            ) : null}

            <Botao type="submit" disabled={enviando} className="w-full">
              {enviando ? "Entrando…" : "Entrar"}
            </Botao>
          </form>
        </Card>
      </div>
    </div>
  );
}
