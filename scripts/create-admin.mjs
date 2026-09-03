// Cria (ou atualiza a senha de) um usuário ADMIN para login local.
// Uso: node scripts/create-admin.mjs email@exemplo.com "senha123" "Nome Completo"
import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

const [, , rawEmail, password, name] = process.argv;

if (!rawEmail || !password) {
  console.error('Uso: node scripts/create-admin.mjs email@exemplo.com "senha" "Nome Completo"');
  process.exit(1);
}

const email = rawEmail.trim().toLowerCase();
const db = new PrismaClient();

const passwordHash = await hash(password, 10);

const user = await db.user.upsert({
  where: { email },
  update: { passwordHash, permissionLevel: "ADMIN" },
  create: { email, name: name ?? email, passwordHash, permissionLevel: "ADMIN", funcao: "OUTROS" },
});

console.log(`Usuário ADMIN pronto: ${user.email} (id: ${user.id})`);
await db.$disconnect();
