import "server-only";
import { hasDatabaseUrl } from "@/lib/db/neon";

/**
 * Credencial de administração guardada no `.env.local`, para o `/admin` ter um
 * login de verdade antes de existir Neon.
 *
 * Existe porque o usuário do `/admin` mora na tabela `osg_usuarios`: sem banco
 * não há conta, e a alternativa que havia era o `ADMIN_DEV_BYPASS`, que abre a
 * área restrita **sem senha alguma**. Isto é estritamente mais fechado do que
 * aquilo: pede e-mail e senha, confere com o mesmo scrypt do banco e emite a
 * mesma sessão assinada.
 *
 * Duas condições, independentes de propósito, e as duas têm de valer:
 *
 * 1. `NODE_ENV !== "production"`. Quem grava isso é o Next — `next build` e o
 *    Vercel escrevem "production", e o Next ignora tentativas de sobrescrever
 *    NODE_ENV por arquivo `.env`. Vazar a variável para o Vercel não abre nada.
 * 2. **Não haver banco configurado.** Havendo `DATABASE_URL`, o login volta a
 *    ser só o do Neon e esta credencial fica inalcançável — assim ela nunca tem
 *    como sombrear uma conta real nem sobreviver a um deploy mal configurado.
 *
 * A senha nunca aparece em texto no arquivo: `ADMIN_LOCAL_SENHA_HASH` guarda o
 * `salt:hash` scrypt, o mesmo formato da coluna `senha_hash`. Gere com
 * `npx tsx scripts/hash-senha.ts <senha>`.
 */
export type CredencialLocal = {
  id: string;
  email: string;
  nome: string;
  senhaHash: string;
};

let avisou = false;

export function credencialLocal(): CredencialLocal | null {
  if (process.env.NODE_ENV === "production") return null;
  if (hasDatabaseUrl()) return null;

  const email = (process.env.ADMIN_LOCAL_EMAIL ?? "").trim().toLowerCase();
  const senhaHash = (process.env.ADMIN_LOCAL_SENHA_HASH ?? "").trim();
  if (!email || !senhaHash) return null;

  if (!avisou) {
    avisou = true;
    console.warn(
      "[osg] Login local ativo: /admin autentica pelo .env.local porque não há DATABASE_URL. Só em desenvolvimento."
    );
  }

  return {
    id: "admin-local",
    email,
    nome: process.env.ADMIN_LOCAL_NOME || "Administração (local)",
    senhaHash,
  };
}
