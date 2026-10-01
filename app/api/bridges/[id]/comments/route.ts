import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-helpers";
import { canAccessBridgeForPlanet, canEditWireframeContent } from "@/lib/nova/permissions";
import { resolveAuthors, serializeComment } from "@/lib/bridges/comments";

interface Params {
  params: { id: string };
}

// GET /api/bridges/:id/comments -> lista as threads de comentário
// (ferramenta Comentário, Wireframe-1b) de um Bridge, com as respostas já
// incluídas e autores resolvidos.
export async function GET(_request: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const bridge = await db.bridge.findUnique({ where: { id: params.id }, select: { planetContextNodeId: true } });
  if (!bridge) return NextResponse.json({ error: "Bridge não encontrado." }, { status: 404 });

  const permission = await canAccessBridgeForPlanet({ planetId: bridge.planetContextNodeId, user });
  if (!permission.allowed) return NextResponse.json({ error: permission.reason }, { status: 403 });

  const comments = await db.wireframeComment.findMany({
    where: { bridgeId: params.id },
    include: { replies: { orderBy: { createdAt: "asc" } } },
    orderBy: { createdAt: "asc" },
  });

  const authorIds = comments.flatMap((c) => [c.authorId, ...c.replies.map((r) => r.authorId)]);
  const authors = await resolveAuthors(authorIds);

  return NextResponse.json({ comments: comments.map((c) => serializeComment(c, authors)) });
}

// POST /api/bridges/:id/comments -> cria um pino de comentário novo
// (ferramenta Comentário, clique no canvas + texto inicial).
export async function POST(request: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const bridge = await db.bridge.findUnique({ where: { id: params.id }, select: { planetContextNodeId: true, status: true, uxUserId: true } });
  if (!bridge) return NextResponse.json({ error: "Bridge não encontrado." }, { status: 404 });

  const permission = await canAccessBridgeForPlanet({ planetId: bridge.planetContextNodeId, user });
  if (!permission.allowed) return NextResponse.json({ error: permission.reason }, { status: 403 });

  if (!canEditWireframeContent(bridge, user)) {
    return NextResponse.json({ error: "Você não tem permissão para editar o Wireframe neste momento." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const x = typeof body.x === "number" && Number.isFinite(body.x) ? body.x : null;
  const y = typeof body.y === "number" && Number.isFinite(body.y) ? body.y : null;
  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (x === null || y === null) return NextResponse.json({ error: "Posição (x, y) é obrigatória." }, { status: 400 });
  if (!text) return NextResponse.json({ error: "O comentário não pode ficar vazio." }, { status: 400 });

  const created = await db.wireframeComment.create({
    data: { bridgeId: params.id, x, y, text, authorId: user.id },
    include: { replies: true },
  });
  const authors = await resolveAuthors([user.id]);

  return NextResponse.json({ comment: serializeComment(created, authors) });
}
