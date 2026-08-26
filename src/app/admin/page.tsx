import type { Metadata } from "next";
import { getSession } from "@/lib/auth/session";
import { Importacao } from "@/components/admin/importacao";
import { Login } from "@/components/admin/login";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Área restrita",
  robots: { index: false, follow: false },
};

/**
 * A sessão é lida no servidor, não no cliente: assim o formulário de login e a
 * tela de importação nunca chegam juntos ao navegador. Ainda assim, quem protege
 * de verdade são as rotas de escrita — elas exigem a sessão assinada antes de
 * tocar no banco, independentemente do que a interface mostre.
 */
export default async function PaginaAdmin() {
  const sessao = await getSession();
  if (!sessao) return <Login />;
  return <Importacao usuario={{ nome: sessao.nome, email: sessao.email }} />;
}
