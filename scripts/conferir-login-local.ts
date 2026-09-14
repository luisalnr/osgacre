/**
 * Confere as duas guardas do login local do /admin.
 *
 *     npx tsx scripts/conferir-login-local.ts
 *
 * A credencial de `ADMIN_LOCAL_*` só pode existir fora de produção E sem banco.
 * As duas condições são independentes: cada uma sozinha basta para fechar a
 * porta. Este script exercita as quatro combinações e sai com 1 se alguma
 * abrir onde não devia.
 */
import Module from "node:module";

/**
 * `credenciais-locais.ts` e `db/neon.ts` importam `server-only`, que existe para
 * explodir se o módulo cair num bundle de cliente. Fora do Next ele explode
 * sempre, então aqui o pedido é atendido com um objeto vazio. O stub vive só
 * neste script: o código que vai para produção mantém a proteção.
 */
const carregar = (Module as unknown as { _load: (...a: unknown[]) => unknown })._load;
(Module as unknown as { _load: (...a: unknown[]) => unknown })._load = function (
  this: unknown,
  pedido: unknown,
  ...resto: unknown[]
) {
  if (pedido === "server-only") return {};
  return carregar.call(this, pedido, ...resto);
};

const CASOS: {
  nome: string;
  nodeEnv: string;
  databaseUrl?: string;
  esperado: boolean;
}[] = [
  { nome: "dev, sem banco", nodeEnv: "development", esperado: true },
  {
    nome: "dev, COM banco",
    nodeEnv: "development",
    databaseUrl: "postgresql://u:s@ex.neon.tech/db?sslmode=require",
    esperado: false,
  },
  { nome: "produção, sem banco", nodeEnv: "production", esperado: false },
  {
    nome: "produção, COM banco",
    nodeEnv: "production",
    databaseUrl: "postgresql://u:s@ex.neon.tech/db?sslmode=require",
    esperado: false,
  },
];

async function main() {
  // Import dinâmico, e não estático: o `import` do topo seria içado para antes
  // do stub de `server-only` e o módulo explodiria ao carregar.
  // Um import só serve para todos os casos: `credencialLocal` lê NODE_ENV e
  // DATABASE_URL a cada chamada, e o único estado do módulo é o aviso de
  // console, que não muda o resultado.
  const { credencialLocal } = await import("../src/lib/auth/credenciais-locais");

  process.env.ADMIN_LOCAL_EMAIL = "admin@exemplo.local";
  process.env.ADMIN_LOCAL_SENHA_HASH = "salt:hash";

  let falhou = false;
  for (const caso of CASOS) {
    process.env.NODE_ENV = caso.nodeEnv;
    if (caso.databaseUrl) process.env.DATABASE_URL = caso.databaseUrl;
    else delete process.env.DATABASE_URL;

    const obtido = credencialLocal() !== null;
    const ok = obtido === caso.esperado;
    if (!ok) falhou = true;
    console.log(
      `${ok ? "ok  " : "FALHA"} ${caso.nome.padEnd(22)} credencial ${obtido ? "ATIVA" : "fechada"}` +
        ` (esperado ${caso.esperado ? "ATIVA" : "fechada"})`
    );
  }

  // Sem as variáveis não há credencial, mesmo no ambiente que as permitiria.
  process.env.NODE_ENV = "development";
  delete process.env.DATABASE_URL;
  delete process.env.ADMIN_LOCAL_SENHA_HASH;
  const semHash = credencialLocal() === null;
  if (!semHash) falhou = true;
  console.log(
    `${semHash ? "ok  " : "FALHA"} sem ADMIN_LOCAL_SENHA_HASH  credencial ${semHash ? "fechada" : "ATIVA"} (esperado fechada)`
  );

  if (falhou) {
    console.error("\nAlguma guarda do login local não fechou. Não suba assim.");
    process.exit(1);
  }
  console.log("\nAs duas guardas fecham em todas as combinações.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
