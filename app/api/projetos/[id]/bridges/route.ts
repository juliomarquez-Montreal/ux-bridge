import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-helpers";
import { canAccessBridgeForPlanet } from "@/lib/nova/permissions";
import { canManageProject } from "@/lib/projects/permissions";

interface Params {
  params: { id: string };
}

// POST /api/projetos/:id/bridges -> vincula um Bridge já existente a este
// Projeto ({ bridgeId }). Bloqueia se o Bridge já pertence a outro Projeto
// (ou a este mesmo) — @@unique em bridgeId garante isso no banco, mas
// validamos antes pra devolver uma mensagem clara em vez do erro genérico
// de constraint.
export async function POST(request: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const permission = await canManageProject({ projectId: params.id, user });
  if (!permission.allowed) return NextResponse.json({ error: permission.reason }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const bridgeId = typeof body.bridgeId === "string" ? body.bridgeId : "";
  if (!bridgeId) return NextResponse.json({ error: "bridgeId é obrigatório." }, { status: 400 });

  const bridge = await db.bridge.findUnique({
    where: { id: bridgeId },
    select: { id: true, planetContextNodeId: true, projectLink: { select: { id: true } } },
  });
  if (!bridge) return NextResponse.json({ error: "Bridge não encontrado." }, { status: 404 });
  if (bridge.projectLink) {
    return NextResponse.json({ error: "Este Bridge já está vinculado a um Projeto." }, { status: 409 });
  }

  const bridgeAccess = await canAccessBridgeForPlanet({ planetId: bridge.planetContextNodeId, user });
  if (!bridgeAccess.allowed) return NextResponse.json({ error: bridgeAccess.reason }, { status: 403 });

  const link = await db.projectBridgeLink.create({
    data: { projectId: params.id, bridgeId, linkedById: user.id },
  });

  return NextResponse.json({ link }, { status: 201 });
}
