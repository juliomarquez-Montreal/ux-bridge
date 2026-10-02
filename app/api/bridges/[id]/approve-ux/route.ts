import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-helpers";
import { canAccessBridgeForPlanet, canEditWireframeContent } from "@/lib/nova/permissions";
import { BRIDGE_WITH_PLANET_INCLUDE } from "@/lib/bridges/include";
import { logActivity } from "@/lib/activity/logActivity";
import { WIREFRAME_FRAME_WIDTH, WIREFRAME_FRAME_HEIGHT } from "@/lib/bridges/wireframeLayout";
import { renderWireframeSvg } from "@/lib/bridges/wireframeSvg";
import { ensureWireframeExportsBucket, getSupabaseAdmin, WIREFRAME_EXPORTS_BUCKET } from "@/lib/supabase-admin";
import type { WireframeBlock } from "@/app/bridges/types";

// POST /api/bridges/:id/approve-ux -> botão "Aprovar e Exportar" (Wireframe-2).
// Só o uxUserId atribuído (ou ADMIN) pode chamar — ver canEditWireframeContent,
// a mesma regra que já gate-ia a edição do canvas nesta fase. Gera o SVG final
// (excluindo blocos/anotações ocultos e sem nenhum pino de comentário — essa é
// a entrega visual limpa pro Figma, não a UI do editor), salva no Storage, e
// fecha o ciclo: status vira FINALIZADO.
export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const bridge = await db.bridge.findUnique({ where: { id: params.id } });
  if (!bridge) return NextResponse.json({ error: "Bridge não encontrado." }, { status: 404 });

  const permission = await canAccessBridgeForPlanet({ planetId: bridge.planetContextNodeId, user });
  if (!permission.allowed) return NextResponse.json({ error: permission.reason }, { status: 403 });

  if (bridge.status !== "AGUARDANDO_APROVACAO_UX") {
    return NextResponse.json({ error: "Este Bridge não está aguardando aprovação do UX." }, { status: 400 });
  }
  if (!canEditWireframeContent(bridge, user)) {
    return NextResponse.json({ error: "Só o UX responsável por este Bridge (ou um administrador) pode aprovar e exportar." }, { status: 403 });
  }

  const wireframeData = bridge.wireframeData as unknown as { frameWidth?: number; frameHeight?: number; blocks?: WireframeBlock[] } | null;
  const annotations = await db.wireframeAnnotation.findMany({ where: { bridgeId: bridge.id } });

  const svg = renderWireframeSvg({
    frameWidth: wireframeData?.frameWidth ?? WIREFRAME_FRAME_WIDTH,
    frameHeight: wireframeData?.frameHeight ?? WIREFRAME_FRAME_HEIGHT,
    blocks: wireframeData?.blocks ?? [],
    annotations: annotations.map((a) => ({ pathData: a.pathData, color: a.color, hidden: a.hidden })),
  });

  await ensureWireframeExportsBucket();
  const admin = getSupabaseAdmin();
  const path = `${bridge.id}/${Date.now()}-wireframe.svg`;
  const { error: uploadError } = await admin.storage
    .from(WIREFRAME_EXPORTS_BUCKET)
    .upload(path, Buffer.from(svg, "utf-8"), { contentType: "image/svg+xml", upsert: false });
  if (uploadError) return NextResponse.json({ error: "Falha ao salvar o arquivo exportado." }, { status: 500 });

  const { data: publicUrlData } = admin.storage.from(WIREFRAME_EXPORTS_BUCKET).getPublicUrl(path, { download: "wireframe.svg" });

  const updated = await db.bridge.update({
    where: { id: bridge.id },
    data: { status: "FINALIZADO", wireframeExportUrl: publicUrlData.publicUrl },
    include: BRIDGE_WITH_PLANET_INCLUDE,
  });

  await logActivity({
    userId: user.id,
    action: "WIREFRAME_APPROVED_UX",
    entityType: "WIREFRAME",
    entityId: bridge.id,
    entityLabel: updated.planet.name,
    galaxyFromNodeId: bridge.planetContextNodeId,
  });

  return NextResponse.json({ bridge: updated });
}
