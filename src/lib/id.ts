/**
 * Hash FNV-1a de 64 bits em hexadecimal, para ids estáveis derivados do
 * conteúdo da linha: reimportar a mesma planilha produz os mesmos ids, o que
 * torna o upsert idempotente. Roda igual no browser e no Node.
 */
export function hashId(...partes: (string | number)[]): string {
  const texto = partes.join("");
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < texto.length; i++) {
    const c = texto.charCodeAt(i);
    h1 ^= c;
    h1 = Math.imul(h1, 0x01000193) >>> 0;
    h2 ^= c + i;
    h2 = Math.imul(h2, 0x85ebca6b) >>> 0;
  }
  return h1.toString(16).padStart(8, "0") + h2.toString(16).padStart(8, "0");
}
