/**
 * Cria (ou atualiza) o usuário que entra no /admin.
 *
 *   npm run db:seed-admin
 *
 * Lê ADMIN_EMAIL, ADMIN_PASSWORD e ADMIN_NAME do .env.local. A senha nunca é
 * gravada em texto: vai como scrypt no formato `salt:hash`.
 */
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { hashPassword } from "../src/lib/auth/password";
import { hashId } from "../src/lib/id";
import * as schema from "../src/lib/db/schema";

function resolverUrl(): string {
  const raw =
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.DATABASE_URL_UNPOOLED ||
    "";
  if (!raw) {
    console.error("DATABASE_URL não definida.");
    process.exit(1);
  }
  try {
    const u = new URL(raw);
    u.searchParams.delete("channel_binding");
    if (!u.searchParams.has("sslmode")) u.searchParams.set("sslmode", "require");
    return u.toString();
  } catch {
    return raw;
  }
}

async function main() {
  const email = (process.env.ADMIN_EMAIL ?? "").trim().toLowerCase();
  const senha = process.env.ADMIN_PASSWORD ?? "";
  const nome = process.env.ADMIN_NAME ?? "Administração";

  if (!email || !senha) {
    console.error("Defina ADMIN_EMAIL e ADMIN_PASSWORD no .env.local.");
    process.exit(1);
  }
  if (senha.length < 10) {
    console.error("Use uma senha com pelo menos 10 caracteres.");
    process.exit(1);
  }

  const db = drizzle(neon(resolverUrl()), { schema });
  await db
    .insert(schema.usuarios)
    .values({
      id: hashId("usuario", email),
      email,
      nome,
      senhaHash: hashPassword(senha),
      papel: "admin",
    })
    .onConflictDoUpdate({
      target: schema.usuarios.email,
      set: { nome, senhaHash: hashPassword(senha) },
    });

  console.log(`Usuário ${email} pronto para entrar em /admin.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
