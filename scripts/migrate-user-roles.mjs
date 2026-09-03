// Migra User.role (PO | UX | ADMIN) para os novos campos permissionLevel + funcao.
// ADMIN -> permissionLevel=ADMIN, funcao=OUTROS
// PO    -> permissionLevel=USER,  funcao=PO
// UX    -> permissionLevel=USER,  funcao=UX
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const MAPPING = {
  ADMIN: { permissionLevel: "ADMIN", funcao: "OUTROS" },
  PO: { permissionLevel: "USER", funcao: "PO" },
  UX: { permissionLevel: "USER", funcao: "UX" },
};

const users = await db.user.findMany({ where: { role: { not: null } } });

for (const user of users) {
  const mapping = MAPPING[user.role];
  if (!mapping) {
    console.warn(`Usuário ${user.email} tem role desconhecida (${user.role}), pulando.`);
    continue;
  }
  await db.user.update({ where: { id: user.id }, data: mapping });
  console.log(`${user.email}: role=${user.role} -> permissionLevel=${mapping.permissionLevel}, funcao=${mapping.funcao}`);
}

console.log(`Migração concluída: ${users.length} usuário(s) processado(s).`);
await db.$disconnect();
