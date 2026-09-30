import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-helpers";
import { canAccessBridgeForPlanet } from "@/lib/nova/permissions";

interface Params {
  params: { id: string; annotationId: string };
}

// PATCH /api/bridges/:id/annotations/:annotationId -> move um traço inteiro
// (arrastar no canvas já recalcula o pathData deslocado no client, aqui só
// grava o resultado final).
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
  const pathData = typeof body.pathData === "string" ? body.pathData.trim() : "";
  if (!pathData) return NextResponse.json({ error: "pathData é obrigatório." }, { status: 400 });

  const updated = await db.wireframeAnnotation.update({ where: { id: params.annotationId }, data: { pathData } });
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
