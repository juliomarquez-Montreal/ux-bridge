// Cria a raiz da árvore da NOVA (Fase N1): o Universo "Governo de Minas
// Gerais" e as Galáxias reais dentro dele. Idempotente (upsert por nome+tipo).
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function upsertNode(type, name, parentId) {
  const existing = await db.contextNode.findFirst({ where: { type, name, parentId } });
  if (existing) return existing;
  return db.contextNode.create({ data: { type, name, parentId } });
}

const universo = await upsertNode("UNIVERSO", "Governo de Minas Gerais", null);
console.log(`UNIVERSO: ${universo.name} (${universo.id})`);

const galaxias = ["ARTEMIG-Concessões", "SGTP-Transporte"];
for (const nome of galaxias) {
  const galaxia = await upsertNode("GALAXIA", nome, universo.id);
  console.log(`  GALAXIA: ${galaxia.name} (${galaxia.id})`);
}

await db.$disconnect();
