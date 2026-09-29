import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-helpers";
import { BRIDGE_WITH_PLANET_INCLUDE } from "@/lib/bridges/include";
import { runSketchGeneration } from "@/lib/bridges/generate";
import { canAccessBridgeForPlanet } from "@/lib/nova/permissions";

// A aprovação do BDD dispara a geração do Sketch dentro da própria
// requisição (mesmo padrão síncrono do Bridge-1) — pode levar um tempo.
export const maxDuration = 60;

interface Params {
  params: { id: string };
}

// POST /api/bridges/:id/approve -> aprovação em duas etapas (Bridge-3a):
// - AGUARDANDO_APROVACAO_BDD: PO confirma o texto do BDD/PBI. Grava
//   bddApprovedAt, cria o PlanetExample (par inicial/final) automaticamente
//   e dispara a geração do Sketch, avançando para AGUARDANDO_APROVACAO_SKETCH.
// - AGUARDANDO_APROVACAO_SKETCH: PO aprova o Sketch. Bridge-3a para por
//   aqui (AGUARDANDO_WIREFRAME é estado final nesta fase — o wireframe de
//   verdade vem no Bridge-5).
export async function POST(_request: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const bridge = await db.bridge.findUnique({ where: { id: params.id } });
  if (!bridge) return NextResponse.json({ error: "Bridge não encontrado." }, { status: 404 });

  const permission = await canAccessBridgeForPlanet({ planetId: bridge.planetContextNodeId, user });
  if (!permission.allowed) return NextResponse.json({ error: permission.reason }, { status: 403 });

  if (bridge.status === "AGUARDANDO_APROVACAO_BDD") {
    if (!bridge.generatedBddPbi) {
      return NextResponse.json({ error: "Este Bridge não tem um BDD/PBI gerado." }, { status: 400 });
    }

    await db.bridge.update({ where: { id: bridge.id }, data: { bddApprovedAt: new Date() } });

    // Fecha o ciclo de memória (item 9 do Bridge-3a): a primeira versão
    // gerada vira initialTextContent, a versão finalmente aprovada vira
    // finalTextContent — alimenta a Memória do Tipo de Planeta sem esforço
    // manual do usuário.
    await db.planetExample.create({
      data: {
        contextNodeId: bridge.planetContextNodeId,
        kind: "FINAL_BDD_PBI",
        initialTextContent: bridge.firstGeneratedBddPbi ?? bridge.generatedBddPbi,
        finalTextContent: bridge.generatedBddPbi,
        uploadedById: user.id,
      },
    });

    await runSketchGeneration(bridge.id);

    const updated = await db.bridge.findUnique({ where: { id: bridge.id }, include: BRIDGE_WITH_PLANET_INCLUDE });
    return NextResponse.json({ bridge: updated });
  }

  if (bridge.status === "AGUARDANDO_APROVACAO_SKETCH") {
    const updated = await db.bridge.update({
      where: { id: bridge.id },
      data: { status: "AGUARDANDO_WIREFRAME" },
      include: BRIDGE_WITH_PLANET_INCLUDE,
    });
    return NextResponse.json({ bridge: updated });
  }

  return NextResponse.json({ error: "Este Bridge não está aguardando aprovação." }, { status: 400 });
}
