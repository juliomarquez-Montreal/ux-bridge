// Remove um bloco GROUP criado por engano no Bridge real "Listagem" durante
// um teste de agrupamento (Ctrl+G) que acabou sendo executado no Bridge
// errado. Só desfaz o agrupamento (parentBlockId -> null pros filhos, remove
// o bloco GROUP) — não toca em x/y/width/height/label de nenhum bloco.
import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();

const REAL_BRIDGE_ID = "cmumq36e60001jj04wbhle2wx";

async function main() {
  const bridge = await db.bridge.findUniqueOrThrow({
    where: { id: REAL_BRIDGE_ID },
    include: { planet: { select: { name: true } } },
  });

  if (bridge.planet.name !== "Listagem") {
    throw new Error(`Guarda de segurança: esperava Planeta "Listagem", achou "${bridge.planet.name}". Abortando.`);
  }

  const data = bridge.wireframeData;
  const blocks = data.blocks;
  const groupBlocks = blocks.filter((b) => b.kind === "GROUP");

  if (groupBlocks.length === 0) {
    console.log("Nenhum bloco GROUP encontrado — nada para corrigir.");
    await db.$disconnect();
    return;
  }

  console.log(`Encontrado(s) ${groupBlocks.length} bloco(s) GROUP pra remover:`, groupBlocks.map((b) => ({ id: b.id, label: b.label })));

  const groupIds = new Set(groupBlocks.map((b) => b.id));
  const fixedBlocks = blocks
    .filter((b) => !groupIds.has(b.id))
    .map((b) => ({
      ...b,
      parentBlockId: b.parentBlockId && groupIds.has(b.parentBlockId) ? null : b.parentBlockId,
    }));

  await db.bridge.update({
    where: { id: REAL_BRIDGE_ID },
    data: { wireframeData: { ...data, blocks: fixedBlocks } },
  });

  const after = await db.bridge.findUniqueOrThrow({ where: { id: REAL_BRIDGE_ID }, select: { wireframeData: true } });
  console.log(`Depois da correção: ${after.wireframeData.blocks.length} blocos.`);
  console.log(JSON.stringify(after.wireframeData.blocks.map((b) => ({ label: b.label, kind: b.kind, parentBlockId: b.parentBlockId, siblingOrder: b.siblingOrder })), null, 2));

  await db.$disconnect();
}

main();
