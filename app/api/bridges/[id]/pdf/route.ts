import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-helpers";
import { canAccessBridgeForPlanet } from "@/lib/nova/permissions";
import { WIREFRAME_FRAME_WIDTH, WIREFRAME_FRAME_HEIGHT } from "@/lib/bridges/wireframeLayout";
import { renderWireframeSvg } from "@/lib/bridges/wireframeSvg";
import { generateBridgePdf } from "@/lib/bridges/pdfExport";
import type { WireframeBlock } from "@/app/bridges/types";

// GET /api/bridges/:id/pdf -> ícone de download em /bridges (coluna Ações):
// um PDF único com o BDD/PBI aprovado + uma imagem do estado atual do
// Wireframe (reaproveita o mesmo renderWireframeSvg da Wireframe-2,
// rasterizado em PNG pra poder entrar no PDF). Mesmo escopo de permissão das
// outras ações da linha (Galáxia do usuário) — diferente do link de
// compartilhar, que é intencionalmente mais aberto (ver .../shared).
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const bridge = await db.bridge.findUnique({ where: { id: params.id } });
  if (!bridge) return NextResponse.json({ error: "Bridge não encontrado." }, { status: 404 });

  const permission = await canAccessBridgeForPlanet({ planetId: bridge.planetContextNodeId, user });
  if (!permission.allowed) return NextResponse.json({ error: permission.reason }, { status: 403 });

  if (!bridge.bddApprovedAt) {
    return NextResponse.json({ error: "Este Bridge ainda não tem um BDD/PBI aprovado." }, { status: 400 });
  }

  const planet = await db.contextNode.findUnique({ where: { id: bridge.planetContextNodeId }, select: { name: true } });

  const wireframeData = bridge.wireframeData as unknown as { frameWidth?: number; frameHeight?: number; blocks?: WireframeBlock[] } | null;
  let wireframeSvg: string | null = null;
  if (wireframeData?.blocks) {
    const annotations = await db.wireframeAnnotation.findMany({ where: { bridgeId: bridge.id } });
    wireframeSvg = renderWireframeSvg({
      frameWidth: wireframeData.frameWidth ?? WIREFRAME_FRAME_WIDTH,
      frameHeight: wireframeData.frameHeight ?? WIREFRAME_FRAME_HEIGHT,
      blocks: wireframeData.blocks,
      annotations: annotations.map((a) => ({ pathData: a.pathData, color: a.color, hidden: a.hidden })),
    });
  }

  const pdfBytes = await generateBridgePdf({
    planetName: planet?.name ?? "Bridge",
    generatedBddPbi: bridge.generatedBddPbi,
    bddApprovedAt: bridge.bddApprovedAt?.toISOString() ?? null,
    wireframeSvg,
    wireframeIsDraft: bridge.status !== "FINALIZADO",
  });

  return new NextResponse(Buffer.from(pdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${(planet?.name ?? "bridge").replace(/[^a-zA-Z0-9-_]/g, "_")}.pdf"`,
    },
  });
}
