import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-helpers";
import { WIREFRAME_FRAME_WIDTH, WIREFRAME_FRAME_HEIGHT } from "@/lib/bridges/wireframeLayout";
import { renderWireframeSvg } from "@/lib/bridges/wireframeSvg";
import type { WireframeBlock } from "@/app/bridges/types";

// GET /api/bridges/:id/shared/svg -> imagem do estado atual do Wireframe pra
// tela de compartilhamento (app/bridges/[id]/share/page.tsx, <img src>).
// Mesma regra de acesso de .../shared: qualquer usuário autenticado, sem
// checagem de Galáxia.
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const bridge = await db.bridge.findUnique({ where: { id: params.id } });
  if (!bridge) return NextResponse.json({ error: "Bridge não encontrado." }, { status: 404 });

  const wireframeData = bridge.wireframeData as unknown as { frameWidth?: number; frameHeight?: number; blocks?: WireframeBlock[] } | null;
  if (!wireframeData?.blocks) {
    return NextResponse.json({ error: "Wireframe ainda não gerado." }, { status: 404 });
  }

  const annotations = await db.wireframeAnnotation.findMany({ where: { bridgeId: bridge.id } });
  const svg = renderWireframeSvg({
    frameWidth: wireframeData.frameWidth ?? WIREFRAME_FRAME_WIDTH,
    frameHeight: wireframeData.frameHeight ?? WIREFRAME_FRAME_HEIGHT,
    blocks: wireframeData.blocks,
    annotations: annotations.map((a) => ({ pathData: a.pathData, color: a.color, hidden: a.hidden })),
  });

  return new NextResponse(svg, { headers: { "Content-Type": "image/svg+xml", "Cache-Control": "no-store" } });
}
