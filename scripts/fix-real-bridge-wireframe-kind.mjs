// Correção ÚNICA e ESPECÍFICA do Bridge real "Listagem" — backfill de
// kind/parentBlockId/siblingOrder nos blocos gravados pela migração
// standalone da Wireframe-1a (scripts/migrate-wireframe-1a.mjs), que rodou
// ANTES desses campos existirem no modelo. Não toca em mais nada: nenhuma
// posição/tamanho/label muda, só os 3 campos novos são preenchidos com os
// defaults corretos (nenhum bloco é GROUP, todos são raiz).
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
  const missingCount = blocks.filter((b) => b.kind === undefined).length;
  console.log(`Bridge ${REAL_BRIDGE_ID} (${bridge.planet.name}): ${blocks.length} blocos, ${missingCount} sem "kind".`);

  if (missingCount === 0) {
    console.log("Nada para corrigir — todos os blocos já têm kind definido.");
    await db.$disconnect();
    return;
  }

  const fixedBlocks = blocks.map((b, index) => ({
    ...b,
    kind: b.kind ?? "ELEMENT",
    parentBlockId: b.parentBlockId ?? null,
    siblingOrder: typeof b.siblingOrder === "number" ? b.siblingOrder : index,
  }));

  await db.bridge.update({
    where: { id: REAL_BRIDGE_ID },
    data: { wireframeData: { ...data, blocks: fixedBlocks } },
  });

  const after = await db.bridge.findUniqueOrThrow({ where: { id: REAL_BRIDGE_ID }, select: { wireframeData: true } });
  console.log(JSON.stringify(after.wireframeData.blocks.map((b) => ({ label: b.label, kind: b.kind, parentBlockId: b.parentBlockId, siblingOrder: b.siblingOrder })), null, 2));

  await db.$disconnect();
}

main();
