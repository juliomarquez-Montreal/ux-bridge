import type { WireframeComment, WireframeCommentReply } from "@prisma/client";
import { db } from "@/lib/db";
import type { ApiUserRef, ApiWireframeComment } from "@/app/bridges/types";

// authorId em WireframeComment/WireframeCommentReply é um scalar sem
// @relation formal (mesmo padrão de Bridge.createdById) — resolve nome/
// avatar aqui, numa única consulta por lista, em vez de um include do
// Prisma. Reutilizado pelas 3 rotas de comentários (list/create/reply).
export async function resolveAuthors(userIds: string[]): Promise<Map<string, ApiUserRef>> {
  const uniqueIds = Array.from(new Set(userIds));
  const users = await db.user.findMany({ where: { id: { in: uniqueIds } }, select: { id: true, name: true, avatarUrl: true } });
  return new Map(users.map((u) => [u.id, u]));
}

type CommentWithReplies = WireframeComment & { replies: WireframeCommentReply[] };

export function serializeComment(comment: CommentWithReplies, authors: Map<string, ApiUserRef>): ApiWireframeComment {
  const fallback = (id: string): ApiUserRef => ({ id, name: "Usuário removido", avatarUrl: null });
  return {
    id: comment.id,
    x: comment.x,
    y: comment.y,
    text: comment.text,
    authorId: comment.authorId,
    author: authors.get(comment.authorId) ?? fallback(comment.authorId),
    resolved: comment.resolved,
    createdAt: comment.createdAt.toISOString(),
    replies: comment.replies.map((reply) => ({
      id: reply.id,
      text: reply.text,
      authorId: reply.authorId,
      author: authors.get(reply.authorId) ?? fallback(reply.authorId),
      createdAt: reply.createdAt.toISOString(),
    })),
  };
}
