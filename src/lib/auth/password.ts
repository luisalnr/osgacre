import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const KEY_LEN = 64;

/** Hash no formato `salt:hash` (hex), com scrypt. */
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, KEY_LEN).toString("hex");
  return `${salt}:${hash}`;
}

/** Compara senha em texto com o hash armazenado, sem vazar tempo. */
export function verifyPassword(password: string, stored: string): boolean {
  try {
    const [salt, hash] = stored.split(":");
    if (!salt || !hash) return false;
    const esperado = Buffer.from(hash, "hex");
    const obtido = scryptSync(password, salt, KEY_LEN);
    if (esperado.length !== obtido.length) return false;
    return timingSafeEqual(esperado, obtido);
  } catch {
    return false;
  }
}
