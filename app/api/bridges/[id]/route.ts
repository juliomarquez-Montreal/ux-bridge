import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-helpers";
import { canAccessBridgeForPlanet } from "@/lib/nova/permissions";
import { BRIDGE_WITH_PLANET_INCLUDE } from "@/lib/bridges/include";

interface Params {
  params: { id: string };
}

// GET /api/bridges/:id -> detalhe de um Bridge (tela de revisão / resultado
// final), com Planeta/Estrela/Galáxia resolvidos.
export async function GET(_request: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const bridge = await db.bridge.findUnique({
    where: { id: params.id },
    include: BRIDGE_WITH_PLANET_INCLUDE,
  });
  if (!bridge) return NextResponse.json({ error: "Bridge não encontrado." }, { status: 404 });

  const permission = await canAccessBridgeForPlanet({ planetId: bridge.planetContextNodeId, user });
  if (!permission.allowed) return NextResponse.json({ error: permission.reason }, { status: 403 });

  return NextResponse.json({ bridge });
}

// DELETE /api/bridges/:id -> exclui um Bridge (tela /bridges, ação "lixeira",
// com confirmação já feita no client antes de chamar esta rota).
export async function DELETE(_request: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const bridge = await db.bridge.findUnique({
    where: { id: params.id },
    include: { projectLink: { include: { project: { select: { name: true } } } } },
  });
  if (!bridge) return NextResponse.json({ error: "Bridge não encontrado." }, { status: 404 });

  const permission = await canAccessBridgeForPlanet({ planetId: bridge.planetContextNodeId, user });
  if (!permission.allowed) return NextResponse.json({ error: permission.reason }, { status: 403 });

  // Projeto-1: um Bridge vinculado a um Projeto não pode ser excluído direto
  // daqui — precisa desvincular primeiro (dentro da tela do Projeto), senão
  // o Projeto perderia um Bridge sem ninguém decidir isso explicitamente.
  if (bridge.projectLink) {
    return NextResponse.json(
      { error: `Este Bridge está vinculado ao Projeto "${bridge.projectLink.project.name}". Desvincule-o do Projeto antes de excluir.` },
      { status: 409 }
    );
  }

  await db.bridge.delete({ where: { id: bridge.id } });
  return NextResponse.json({ success: true });
}
