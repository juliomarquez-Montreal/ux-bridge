import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-helpers";
import { canAccessBridgeForPlanet } from "@/lib/nova/permissions";
import { BRIDGE_WITH_PLANET_INCLUDE } from "@/lib/bridges/include";
import { normalizeSketchBlocks, SKETCH_LAYOUT_CORRECTION_PATTERN_TYPE } from "@/lib/bridges/generate";
import { recordApprovedPattern } from "@/lib/memory";

interface Params {
  params: { id: string };
}

// POST /api/bridges/:id/sketch-edit -> salva uma edição manual do Sketch
// feita pelo PO no editor visual (Bridge-3b), como alternativa a "Rejeitar e
// comentar". `blocks` é a lista de blocos já editada (zone/row/order/
// widthHint/heightHint/label); `approve` decide se o Bridge já avança pra
// AGUARDANDO_WIREFRAME (true) ou fica em AGUARDANDO_APROVACAO_SKETCH com a
// versão editada, permitindo repetir o ciclo (aprovar/rejeitar/editar de
// novo).
//
// Toda edição manual grava um MemoryPattern SKETCH_LAYOUT_CORRECTION com
// confidence 1.0 (correção humana explícita = verdade absoluta, não uma
// inferência) — é isso que runSketchGeneration usa pra priorizar esse
// padrão nas próximas gerações do mesmo Tipo de Planeta.
export async function POST(request: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const bridge = await db.bridge.findUnique({ where: { id: params.id } });
  if (!bridge) return NextResponse.json({ error: "Bridge não encontrado." }, { status: 404 });

  const permission = await canAccessBridgeForPlanet({ planetId: bridge.planetContextNodeId, user });
  if (!permission.allowed) return NextResponse.json({ error: permission.reason }, { status: 403 });

  if (bridge.status !== "AGUARDANDO_APROVACAO_SKETCH") {
    return NextResponse.json(
      { error: "Só é possível editar manualmente um Sketch que esteja aguardando aprovação." },
      { status: 400 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const approve = body.approve === true;

  let blocks: ReturnType<typeof normalizeSketchBlocks>;
  try {
    blocks = normalizeSketchBlocks(body.blocks);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Blocos do sketch inválidos." }, { status: 400 });
  }

  const sketchDataAfter = { blocks } as unknown as Prisma.InputJsonValue;

  await recordApprovedPattern({
    contextNodeId: bridge.planetContextNodeId,
    patternType: SKETCH_LAYOUT_CORRECTION_PATTERN_TYPE,
    patternData: { before: bridge.sketchData, after: sketchDataAfter } as Prisma.InputJsonValue,
    sourceApprovalId: bridge.id,
    initialConfidence: 1.0,
  });

  const updated = await db.bridge.update({
    where: { id: bridge.id },
    data: {
      sketchData: sketchDataAfter,
      status: approve ? "AGUARDANDO_WIREFRAME" : "AGUARDANDO_APROVACAO_SKETCH",
    },
    include: BRIDGE_WITH_PLANET_INCLUDE,
  });

  return NextResponse.json({ bridge: updated });
}
