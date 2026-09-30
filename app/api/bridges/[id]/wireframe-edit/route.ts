import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-helpers";
import { canAccessBridgeForPlanet } from "@/lib/nova/permissions";
import { BRIDGE_WITH_PLANET_INCLUDE } from "@/lib/bridges/include";
import { WIREFRAME_LAYOUT_CORRECTION_PATTERN_TYPE } from "@/lib/bridges/generate";
import { normalizeWireframeBlocks, WIREFRAME_FRAME_WIDTH, WIREFRAME_FRAME_HEIGHT } from "@/lib/bridges/wireframeLayout";
import { recordApprovedPattern } from "@/lib/memory";

interface Params {
  params: { id: string };
}

// POST /api/bridges/:id/wireframe-edit -> autosave do editor visual do
// Wireframe (Wireframe-1a): toda edição manual no canvas (mover, redimensionar
// pela ferramenta Selecionar, renomear pela aba Propriedades) chama esta rota
// com debounce (ver components/WireframeEditor.tsx), sem confirmação
// separada — o "Aprovar Wireframe" que avança o status é uma ação à parte
// (ver approve-wireframe/route.ts).
//
// Toda edição manual grava um MemoryPattern WIREFRAME_LAYOUT_CORRECTION com
// confidence 1.0 (correção humana explícita = verdade absoluta, não uma
// inferência) — é isso que runWireframeGeneration usa pra priorizar esse
// padrão nas próximas gerações do mesmo Tipo de Planeta.
export async function POST(request: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const bridge = await db.bridge.findUnique({ where: { id: params.id } });
  if (!bridge) return NextResponse.json({ error: "Bridge não encontrado." }, { status: 404 });

  const permission = await canAccessBridgeForPlanet({ planetId: bridge.planetContextNodeId, user });
  if (!permission.allowed) return NextResponse.json({ error: permission.reason }, { status: 403 });

  if (bridge.status !== "AGUARDANDO_APROVACAO_WIREFRAME_PO") {
    return NextResponse.json(
      { error: "Só é possível editar manualmente um Wireframe que esteja aguardando aprovação do PO." },
      { status: 400 }
    );
  }

  const body = await request.json().catch(() => ({}));

  let blocks: ReturnType<typeof normalizeWireframeBlocks>;
  try {
    blocks = normalizeWireframeBlocks(body.blocks);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Blocos do wireframe inválidos." }, { status: 400 });
  }

  const existing = bridge.wireframeData as { frameWidth?: number; frameHeight?: number } | null;
  const wireframeDataAfter = {
    frameWidth: existing?.frameWidth ?? WIREFRAME_FRAME_WIDTH,
    frameHeight: existing?.frameHeight ?? WIREFRAME_FRAME_HEIGHT,
    blocks,
  } as unknown as Prisma.InputJsonValue;

  await recordApprovedPattern({
    contextNodeId: bridge.planetContextNodeId,
    patternType: WIREFRAME_LAYOUT_CORRECTION_PATTERN_TYPE,
    patternData: { before: bridge.wireframeData, after: wireframeDataAfter } as Prisma.InputJsonValue,
    sourceApprovalId: bridge.id,
    initialConfidence: 1.0,
  });

  const updated = await db.bridge.update({
    where: { id: bridge.id },
    data: { wireframeData: wireframeDataAfter },
    include: BRIDGE_WITH_PLANET_INCLUDE,
  });

  return NextResponse.json({ bridge: updated });
}
