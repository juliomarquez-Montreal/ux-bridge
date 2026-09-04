import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { fetchFigmaComponents, type FigmaComponent } from "./client";

export interface SyncResult {
  created: number;
  updated: number;
  totalSynced: number;
  missingFromLastSync: number;
  warning: string | null;
}

// Busca os componentes publicados do arquivo do Figma dessa fonte e faz
// upsert vinculado a ela. Compartilhado entre POST /sources (sincroniza ao
// criar) e POST /sources/:id/sync (sincronizar sob demanda). Pode lançar
// FigmaApiError (deixa o chamador decidir o status HTTP).
export async function syncDesignSystemSource(source: { id: string; figmaFileKey: string }): Promise<SyncResult> {
  const components = await fetchFigmaComponents(source.figmaFileKey);

  if (components.length === 0) {
    await db.designSystemSource.update({ where: { id: source.id }, data: { lastSyncedAt: new Date() } });
    return {
      created: 0,
      updated: 0,
      totalSynced: 0,
      missingFromLastSync: 0,
      warning:
        "Nenhum componente publicado foi encontrado neste arquivo. Verifique se os elementos estão marcados como Component no Figma (não apenas frames/grupos).",
    };
  }

  const fetchedKeys = components.map((c) => c.key);

  const existing = await db.designSystemComponent.findMany({
    where: { sourceId: source.id, figmaComponentKey: { in: fetchedKeys } },
    select: { figmaComponentKey: true },
  });
  const existingKeySet = new Set(existing.map((e) => e.figmaComponentKey));

  let created = 0;
  let updated = 0;
  for (const component of components) {
    if (existingKeySet.has(component.key)) updated++;
    else created++;
  }

  // Upsert em lote, numa única query (INSERT ... ON CONFLICT DO UPDATE) em
  // vez de N chamadas sequenciais do Prisma: com ~100 componentes, upserts
  // um por um levavam 25-30s e estouravam o timeout do gateway do Vercel
  // (504) mesmo com maxDuration alto — o teto ali é da borda, não da função.
  await upsertComponents(components, source.id);

  await db.designSystemSource.update({ where: { id: source.id }, data: { lastSyncedAt: new Date() } });

  const missingFromLastSync = await db.designSystemComponent.count({
    where: { sourceId: source.id, figmaComponentKey: { not: null, notIn: fetchedKeys } },
  });

  return { created, updated, totalSynced: components.length, missingFromLastSync, warning: null };
}

// INSERT ... ON CONFLICT ("figmaComponentKey") DO UPDATE, numa query só pra
// todos os componentes. figmaComponentKey já é @unique no schema, então esse
// é o índice de conflito de verdade (id/createdAt de uma linha existente não
// são tocados — só os campos do SET).
async function upsertComponents(components: FigmaComponent[], sourceId: string): Promise<void> {
  const rows = components.map(
    (c) =>
      Prisma.sql`(${randomUUID()}, ${c.name}, ${c.key}, ${c.thumbnailUrl}, ${c.description || null}, ${JSON.stringify({ nodeId: c.nodeId })}::jsonb, ${sourceId}, now())`
  );

  await db.$executeRaw`
    INSERT INTO "DesignSystemComponent" (id, name, "figmaComponentKey", "thumbnailUrl", description, metadata, "sourceId", "createdAt")
    VALUES ${Prisma.join(rows)}
    ON CONFLICT ("figmaComponentKey") DO UPDATE SET
      name = EXCLUDED.name,
      "thumbnailUrl" = EXCLUDED."thumbnailUrl",
      description = EXCLUDED.description,
      metadata = EXCLUDED.metadata,
      "sourceId" = EXCLUDED."sourceId"
  `;
}
