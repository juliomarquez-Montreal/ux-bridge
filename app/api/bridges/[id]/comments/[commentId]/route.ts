import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-helpers";
import { canAccessBridgeForPlanet, canEditWireframeContent } from "@/lib/nova/permissions";
import { resolveAuthors, serializeComment } from "@/lib/bridges/comments";

interface Params {
  params: { id: string; commentId: string };
}

// PATCH /api/bridges/:id/comments/:commentId -> marca como resolvido/reabre
// (body: { resolved: boolean }).
export async function PATCH(request: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const comment = await db.wireframeComment.findUnique({ where: { id: params.commentId } });
  if (!comment || comment.bridgeId !== params.id) return NextResponse.json({ error: "Comentário não encontrado." }, { status: 404 });

  const bridge = await db.bridge.findUnique({ where: { id: params.id }, select: { planetContextNodeId: true, status: true, uxUserId: true } });
  if (!bridge) return NextResponse.json({ error: "Bridge não encontrado." }, { status: 404 });

  const permission = await canAccessBridgeForPlanet({ planetId: bridge.planetContextNodeId, user });
  if (!permission.allowed) return NextResponse.json({ error: permission.reason }, { status: 403 });

  if (!canEditWireframeContent(bridge, user)) {
    return NextResponse.json({ error: "Você não tem permissão para editar o Wireframe neste momento." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  if (typeof body.resolved !== "boolean") return NextResponse.json({ error: "resolved (boolean) é obrigatório." }, { status: 400 });

  const updated = await db.wireframeComment.update({
    where: { id: params.commentId },
    data: { resolved: body.resolved },
    include: { replies: { orderBy: { createdAt: "asc" } } },
  });
  const authorIds = [updated.authorId, ...updated.replies.map((r) => r.authorId)];
  const authors = await resolveAuthors(authorIds);

  return NextResponse.json({ comment: serializeComment(updated, authors) });
}

// DELETE /api/bridges/:id/comments/:commentId -> exclui a thread inteira
// (com as respostas, via onDelete: Cascade) — só o autor original do
// comentário ou um ADMIN.
export async function DELETE(_request: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const comment = await db.wireframeComment.findUnique({ where: { id: params.commentId } });
  if (!comment || comment.bridgeId !== params.id) return NextResponse.json({ error: "Comentário não encontrado." }, { status: 404 });

  const bridge = await db.bridge.findUnique({ where: { id: params.id }, select: { planetContextNodeId: true, status: true, uxUserId: true } });
  if (!bridge) return NextResponse.json({ error: "Bridge não encontrado." }, { status: 404 });

  const permission = await canAccessBridgeForPlanet({ planetId: bridge.planetContextNodeId, user });
  if (!permission.allowed) return NextResponse.json({ error: permission.reason }, { status: 403 });

  if (!canEditWireframeContent(bridge, user)) {
    return NextResponse.json({ error: "Você não tem permissão para editar o Wireframe neste momento." }, { status: 403 });
  }

  if (comment.authorId !== user.id && user.permissionLevel !== "ADMIN") {
    return NextResponse.json({ error: "Só o autor do comentário ou um administrador pode excluí-lo." }, { status: 403 });
  }

  await db.wireframeComment.delete({ where: { id: params.commentId } });
  return NextResponse.json({ ok: true });
}
