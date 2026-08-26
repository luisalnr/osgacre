import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { verifyPassword } from "@/lib/auth/password";
import {
  MAX_AGE_SEC,
  SESSION_COOKIE,
  sessionCookieOptions,
  signSession,
} from "@/lib/auth/session";
import { getDb } from "@/lib/db/neon";
import { usuarios } from "@/lib/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Mensagem única para e-mail inexistente e senha errada, para não enumerar contas. */
const CREDENCIAIS_INVALIDAS = "E-mail ou senha incorretos.";

export async function POST(req: Request) {
  let corpo: { email?: string; senha?: string };
  try {
    corpo = (await req.json()) as { email?: string; senha?: string };
  } catch {
    return NextResponse.json({ erro: "Corpo inválido." }, { status: 400 });
  }

  const email = (corpo.email ?? "").trim().toLowerCase();
  const senha = corpo.senha ?? "";
  if (!email || !senha) {
    return NextResponse.json({ erro: CREDENCIAIS_INVALIDAS }, { status: 401 });
  }

  try {
    const db = getDb();
    const [usuario] = await db
      .select()
      .from(usuarios)
      .where(eq(usuarios.email, email))
      .limit(1);

    if (!usuario || !verifyPassword(senha, usuario.senhaHash)) {
      return NextResponse.json({ erro: CREDENCIAIS_INVALIDAS }, { status: 401 });
    }

    const token = signSession({
      id: usuario.id,
      email: usuario.email,
      nome: usuario.nome,
    });
    const jar = await cookies();
    jar.set(SESSION_COOKIE, token, sessionCookieOptions(MAX_AGE_SEC));

    return NextResponse.json({
      usuario: { id: usuario.id, email: usuario.email, nome: usuario.nome },
    });
  } catch (e) {
    // A mensagem real (ex.: DATABASE_URL ausente) fica no log do servidor;
    // a rota de login é pública e não deve descrever a infraestrutura.
    console.error("Falha no login:", e);
    return NextResponse.json(
      { erro: "Serviço de autenticação indisponível no momento." },
      { status: 500 }
    );
  }
}
