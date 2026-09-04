import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-helpers";
import { canManageGalaxy } from "@/lib/nova/permissions";
import { fetchFigmaComponents, FigmaApiError } from "@/lib/figma/client";

interface Params {
  params: { id: string };
}

// O upsert roda sequencial (ver comentário abaixo), então um arquivo com
// muitos componentes pode levar dezenas de segundos — bem acima do limite
// padrão de 10s do Vercel. Sobe o teto pra essa rota especificamente.
export const maxDuration = 60;

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

  // Upsert sequencial (não Promise.all): o pooler do Supabase em modo
  // transaction com connection_limit=1 não lida bem com queries concorrentes
  // do mesmo processo (ver histórico de "prepared statement already exists").
  for (const component of components) {
    if (existingKeySet.has(component.key)) updated++;
    else created++;

    await db.designSystemComponent.upsert({
      where: { figmaComponentKey: component.key },
      create: {
        name: component.name,
        figmaComponentKey: component.key,
        thumbnailUrl: component.thumbnailUrl,
        description: component.description || null,
        metadata: { nodeId: component.nodeId },
        sourceId: source.id,
      },
      update: {
        name: component.name,
        thumbnailUrl: component.thumbnailUrl,
        description: component.description || null,
        metadata: { nodeId: component.nodeId },
        sourceId: source.id,
      },
    });
  }

  await db.designSystemSource.update({ where: { id: source.id }, data: { lastSyncedAt: new Date() } });

  const missingFromLastSync = await db.designSystemComponent.count({
    where: { sourceId: source.id, figmaComponentKey: { not: null, notIn: fetchedKeys } },
  });

  return NextResponse.json({ created, updated, totalSynced: components.length, missingFromLastSync, warning: null });
}
