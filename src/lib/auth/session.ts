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

/** Lê e valida a sessão dos cookies da request. */
export async function getSession(): Promise<SessionPayload | null> {
  try {
    const jar = await cookies();
    return verifySession(jar.get(SESSION_COOKIE)?.value);
  } catch {
    return null;
  }
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
