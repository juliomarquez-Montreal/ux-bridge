import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-helpers";
import { canAccessBridgeForPlanet } from "@/lib/nova/permissions";

interface Params {
  params: { id: string; annotationId: string };
}

// PATCH /api/bridges/:id/annotations/:annotationId -> move/redimensiona um
// traço (pathData recalculado no client, aqui só grava o resultado final) e/
// ou alterna oculto/bloqueado (menu de contexto). Qualquer subconjunto dos 3
// campos pode vir no body.
export async function PATCH(request: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const annotation = await db.wireframeAnnotation.findUnique({ where: { id: params.annotationId } });
  if (!annotation || annotation.bridgeId !== params.id) return NextResponse.json({ error: "Anotação não encontrada." }, { status: 404 });

  const bridge = await db.bridge.findUnique({ where: { id: params.id }, select: { planetContextNodeId: true } });
  if (!bridge) return NextResponse.json({ error: "Bridge não encontrado." }, { status: 404 });

  const permission = await canAccessBridgeForPlanet({ planetId: bridge.planetContextNodeId, user });
  if (!permission.allowed) return NextResponse.json({ error: permission.reason }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const data: { pathData?: string; hidden?: boolean; locked?: boolean } = {};
  if (typeof body.pathData === "string" && body.pathData.trim()) data.pathData = body.pathData.trim();
  if (typeof body.hidden === "boolean") data.hidden = body.hidden;
  if (typeof body.locked === "boolean") data.locked = body.locked;
  if (Object.keys(data).length === 0) return NextResponse.json({ error: "Nenhum campo válido para atualizar." }, { status: 400 });

  const updated = await db.wireframeAnnotation.update({ where: { id: params.annotationId }, data });
  return NextResponse.json({ annotation: updated });
}

// DELETE /api/bridges/:id/annotations/:annotationId -> apaga um traço.
export async function DELETE(_request: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const annotation = await db.wireframeAnnotation.findUnique({ where: { id: params.annotationId } });
  if (!annotation || annotation.bridgeId !== params.id) return NextResponse.json({ error: "Anotação não encontrada." }, { status: 404 });

  const bridge = await db.bridge.findUnique({ where: { id: params.id }, select: { planetContextNodeId: true } });
  if (!bridge) return NextResponse.json({ error: "Bridge não encontrado." }, { status: 404 });

  const permission = await canAccessBridgeForPlanet({ planetId: bridge.planetContextNodeId, user });
  if (!permission.allowed) return NextResponse.json({ error: permission.reason }, { status: 403 });

  await db.wireframeAnnotation.delete({ where: { id: params.annotationId } });
  return NextResponse.json({ ok: true });
}
