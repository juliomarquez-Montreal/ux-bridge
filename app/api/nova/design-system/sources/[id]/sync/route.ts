import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-helpers";
import { canManageGalaxy } from "@/lib/nova/permissions";
import { fetchFigmaComponents, FigmaApiError, type FigmaComponent } from "@/lib/figma/client";

interface Params {
  params: { id: string };
}

// Margem extra: mesmo com o upsert em lote (1 query), a busca no Figma de
// um arquivo grande pode levar alguns segundos.
export const maxDuration = 30;

// POST /api/nova/design-system/sources/:id/sync -> busca os componentes
// publicados do arquivo do Figma dessa fonte e faz upsert vinculado a ela.
// Mesma permissão de gerenciar recursos da Galáxia dona da fonte. Nunca
// apaga componentes sozinho — só sinaliza quantos não vieram nesta rodada.
export async function POST(_request: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const source = await db.designSystemSource.findUnique({ where: { id: params.id } });
  if (!source) return NextResponse.json({ error: "Fonte não encontrada." }, { status: 404 });

  const permission = await canManageGalaxy({ galaxyId: source.galaxyId, user });
  if (!permission.allowed) {
    return NextResponse.json({ error: permission.reason }, { status: 403 });
  }

  let components;
  try {
    components = await fetchFigmaComponents(source.figmaFileKey);
  } catch (error) {
    if (error instanceof FigmaApiError) {
      return NextResponse.json({ error: error.message }, { status: 502 });
    }
    return NextResponse.json({ error: "Falha inesperada ao consultar o Figma." }, { status: 502 });
  }

  if (components.length === 0) {
    await db.designSystemSource.update({ where: { id: source.id }, data: { lastSyncedAt: new Date() } });
    return NextResponse.json({
      created: 0,
      updated: 0,
      totalSynced: 0,
      missingFromLastSync: 0,
      warning:
        "Nenhum componente publicado foi encontrado neste arquivo. Verifique se os elementos estão marcados como Component no Figma (não apenas frames/grupos).",
    });
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
  // Uma query só resolve isso e também evita concorrência contra o pooler
  // em modo transaction (connection_limit=1 — ver histórico de "prepared
  // statement already exists" em fases anteriores).
  await upsertComponents(components, source.id);

  await db.designSystemSource.update({ where: { id: source.id }, data: { lastSyncedAt: new Date() } });

  const missingFromLastSync = await db.designSystemComponent.count({
    where: { sourceId: source.id, figmaComponentKey: { not: null, notIn: fetchedKeys } },
  });

  return NextResponse.json({ created, updated, totalSynced: components.length, missingFromLastSync, warning: null });
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
