import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-helpers";
import { canManageProject } from "@/lib/projects/permissions";

interface Params {
  params: { id: string; bridgeId: string };
}

// PATCH /api/projetos/:id/bridges/:bridgeId -> define/edita a etiqueta de
// ÁREA do Bridge dentro do Projeto ({ area: string | null }). Vazio limpa
// (o Bridge volta a aparecer como "Sem área").
export async function PATCH(request: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const permission = await canManageProject({ projectId: params.id, user });
  if (!permission.allowed) return NextResponse.json({ error: permission.reason }, { status: 403 });

  const link = await db.projectBridgeLink.findUnique({ where: { bridgeId: params.bridgeId } });
  if (!link || link.projectId !== params.id) {
    return NextResponse.json({ error: "Este Bridge não está vinculado a este Projeto." }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  if (body.area !== null && typeof body.area !== "string") {
    return NextResponse.json({ error: "area deve ser texto ou null." }, { status: 400 });
  }
  let area = typeof body.area === "string" && body.area.trim() ? body.area.trim().slice(0, 60) : null;

  // Reaproveita a grafia de uma área já usada no Projeto (ignora maiúsculas/
  // minúsculas) — evita "Login" e "login" virarem duas áreas, mesmo se duas
  // edições chegarem quase juntas.
  if (area) {
    const siblings = await db.projectBridgeLink.findMany({
      where: { projectId: params.id, area: { not: null }, NOT: { bridgeId: params.bridgeId } },
      select: { area: true },
    });
    const existing = siblings.find((s) => s.area!.toLowerCase() === area!.toLowerCase());
    if (existing) area = existing.area;
  }

  await db.projectBridgeLink.update({ where: { bridgeId: params.bridgeId }, data: { area } });
  return NextResponse.json({ ok: true, area });
}

// DELETE /api/projetos/:id/bridges/:bridgeId -> desvincula um Bridge deste
// Projeto (remove o ProjectBridgeLink, nunca o Bridge em si) e limpa o que as
// Ferramentas do PO guardaram sobre ele: veredito do Radar e dependências em
// que ele aparece. (Conflitos e anotações de comparação são filtrados na
// leitura — um Bridge que saiu do Projeto some das listas.)
export async function DELETE(_request: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const permission = await canManageProject({ projectId: params.id, user });
  if (!permission.allowed) return NextResponse.json({ error: permission.reason }, { status: 403 });

  const link = await db.projectBridgeLink.findUnique({ where: { bridgeId: params.bridgeId } });
  if (!link || link.projectId !== params.id) {
    return NextResponse.json({ error: "Este Bridge não está vinculado a este Projeto." }, { status: 404 });
  }

  await db.$transaction([
    db.projectScopeAnalysis.deleteMany({ where: { projectId: params.id, bridgeId: params.bridgeId } }),
    db.bridgeDependency.deleteMany({
      where: { projectId: params.id, OR: [{ bridgeId: params.bridgeId }, { dependsOnBridgeId: params.bridgeId }] },
    }),
    db.projectBridgeLink.delete({ where: { bridgeId: params.bridgeId } }),
  ]);
  return NextResponse.json({ ok: true });
}
