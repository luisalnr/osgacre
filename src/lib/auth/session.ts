import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const SESSION_COOKIE = "osg_session";
export const MAX_AGE_SEC = 60 * 60 * 12;

export type SessionPayload = {
  id: string;
  email: string;
  nome: string;
  exp: number;
};

/**
 * Segredo da assinatura. Em produção venha de SESSION_SECRET; o fallback para a
 * connection string existe só para o ambiente local não quebrar, e o valor
 * literal de desenvolvimento nunca é aceito quando NODE_ENV é production.
 */
function secret(): string {
  const s = process.env.SESSION_SECRET || process.env.DATABASE_URL;
  if (!s) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("SESSION_SECRET não configurada.");
    }
    return "osg-dev-secret-trocar";
  }
  return s;
}

function b64url(data: string | Buffer): string {
  const buf = typeof data === "string" ? Buffer.from(data, "utf8") : data;
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(s: string): string {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64").toString("utf8");
}

export function signSession(
  payload: Omit<SessionPayload, "exp">,
  maxAgeSec = MAX_AGE_SEC
): string {
  const full: SessionPayload = {
    ...payload,
    exp: Math.floor(Date.now() / 1000) + maxAgeSec,
  };
  const body = b64url(JSON.stringify(full));
  const sig = b64url(createHmac("sha256", secret()).update(body).digest());
  return `${body}.${sig}`;
}

export function verifySession(token: string | undefined | null): SessionPayload | null {
  if (!token || !token.includes(".")) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const esperado = b64url(createHmac("sha256", secret()).update(body).digest());
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(esperado);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    const payload = JSON.parse(b64urlDecode(body)) as SessionPayload;
    if (!payload?.email || !payload?.exp) return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export function sessionCookieOptions(maxAgeSec = MAX_AGE_SEC) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: maxAgeSec,
  };
}

let avisouBypass = false;

/**
 * Sessão de desenvolvimento, para abrir o /admin antes de o Neon existir.
 *
 * Exige as DUAS condições, e elas são independentes de propósito:
 *
 * 1. `NODE_ENV !== "production"`. Quem define isso é o Next — `next build` e o
 *    Vercel gravam "production" e o Next ignora tentativas de sobrescrever
 *    NODE_ENV por arquivo .env. Então nem vazar a variável para o Vercel abre
 *    a porta.
 * 2. `ADMIN_DEV_BYPASS=1` explícito no .env.local, que não vai para o git.
 *    Sem ele, `npm run dev` continua pedindo login como sempre — o atalho é
 *    uma escolha de quem roda, não o comportamento padrão do projeto.
 *
 * Isto libera a interface. Não libera o banco: as rotas de escrita seguem
 * gravando no Neon, que sem DATABASE_URL simplesmente não responde.
 */
function sessaoDeDesenvolvimento(): SessionPayload | null {
  if (process.env.NODE_ENV === "production") return null;
  if (process.env.ADMIN_DEV_BYPASS !== "1") return null;

  if (!avisouBypass) {
    avisouBypass = true;
    console.warn(
      "[osg] ADMIN_DEV_BYPASS ativo: /admin aberto sem login. Só em desenvolvimento."
    );
  }

  return {
    id: "dev-bypass",
    email: "sem-login@desenvolvimento",
    nome: "Acesso de desenvolvimento",
    exp: Math.floor(Date.now() / 1000) + MAX_AGE_SEC,
  };
}

/** Lê e valida a sessão dos cookies da request. */
export async function getSession(): Promise<SessionPayload | null> {
  try {
    const jar = await cookies();
    const sessao = verifySession(jar.get(SESSION_COOKIE)?.value);
    if (sessao) return sessao;
  } catch {
    // segue para o bypass, que também pode não valer
  }
  return sessaoDeDesenvolvimento();
}

/**
 * Portão de todas as rotas de escrita. Diferente do painel de empenhos, aqui
 * nenhuma gravação acontece sem sessão válida.
 */
export async function requireSession(): Promise<SessionPayload> {
  const s = await getSession();
  if (!s) throw new NaoAutorizado();
  return s;
}

export class NaoAutorizado extends Error {
  constructor() {
    super("Sessão inválida ou expirada.");
    this.name = "NaoAutorizado";
  }
}
