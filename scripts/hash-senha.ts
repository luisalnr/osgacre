/**
 * Gera o hash scrypt de uma senha, no formato `salt:hash` que o banco guarda.
 *
 *     npx tsx scripts/hash-senha.ts "minha senha longa"
 *     npx tsx scripts/hash-senha.ts            # sorteia uma senha forte
 *
 * Serve para preencher `ADMIN_LOCAL_SENHA_HASH` no `.env.local`, que é como o
 * `/admin` autentica enquanto não há Neon. Em produção quem cria a conta é o
 * `npm run db:seed-admin`, que grava na tabela `osg_usuarios`.
 *
 * A senha em texto só passa pela sua tela: nada aqui grava em arquivo.
 */
import { randomBytes } from "node:crypto";
import { hashPassword } from "../src/lib/auth/password";

const MINIMO = 10;

/** Alfabeto sem caracteres ambíguos (0/O, 1/l/I) e sem aspas, que atrapalham no .env. */
const ALFABETO = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789-_";

function sortearSenha(tamanho = 24): string {
  const bytes = randomBytes(tamanho);
  let s = "";
  for (const b of bytes) s += ALFABETO[b % ALFABETO.length];
  return s;
}

const informada = process.argv.slice(2).join(" ").trim();
const senha = informada || sortearSenha();

if (informada && informada.length < MINIMO) {
  console.error(`Use uma senha com pelo menos ${MINIMO} caracteres.`);
  process.exit(1);
}

console.log(`senha:  ${senha}`);
console.log(`hash:   ${hashPassword(senha)}`);
console.log(
  "\nCopie o hash para ADMIN_LOCAL_SENHA_HASH no .env.local. Guarde a senha: ela não é recuperável a partir do hash."
);
