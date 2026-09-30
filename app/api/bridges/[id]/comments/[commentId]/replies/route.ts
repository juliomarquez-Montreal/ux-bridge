import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-helpers";
import { canAccessBridgeForPlanet } from "@/lib/nova/permissions";
import { resolveAuthors } from "@/lib/bridges/comments";

interface Params {
  params: { id: string; commentId: string };
}

// POST /api/bridges/:id/comments/:commentId/replies -> adiciona uma resposta
// à thread (body: { text }).
export async function POST(request: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const comment = await db.wireframeComment.findUnique({ where: { id: params.commentId } });
  if (!comment || comment.bridgeId !== params.id) return NextResponse.json({ error: "Comentário não encontrado." }, { status: 404 });

  const bridge = await db.bridge.findUnique({ where: { id: params.id }, select: { planetContextNodeId: true } });
  if (!bridge) return NextResponse.json({ error: "Bridge não encontrado." }, { status: 404 });

  const permission = await canAccessBridgeForPlanet({ planetId: bridge.planetContextNodeId, user });
  if (!permission.allowed) return NextResponse.json({ error: permission.reason }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text) return NextResponse.json({ error: "A resposta não pode ficar vazia." }, { status: 400 });

  const reply = await db.wireframeCommentReply.create({
    data: { commentId: params.commentId, authorId: user.id, text },
  });
  const authors = await resolveAuthors([user.id]);
  const author = authors.get(user.id) ?? { id: user.id, name: "Usuário removido", avatarUrl: null };

  return NextResponse.json({
    reply: { id: reply.id, text: reply.text, authorId: reply.authorId, author, createdAt: reply.createdAt.toISOString() },
  });
}
