import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-helpers";

// GET /api/notifications?limit=20 -> notificações do usuário logado (mais novas
// primeiro) + contador de não lidas. Usada pelo sino do header e pelo polling
// (a cada ~20s) que dispara Toast / notificação do navegador.
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const limit = Math.min(50, Math.max(1, parseInt(new URL(request.url).searchParams.get("limit") ?? "20", 10) || 20));

  const [items, unreadCount] = await Promise.all([
    db.notification.findMany({
      where: { userId: user.id },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit,
      select: { id: true, type: true, title: true, body: true, linkUrl: true, read: true, createdAt: true },
    }),
    db.notification.count({ where: { userId: user.id, read: false } }),
  ]);

  return NextResponse.json({ items, unreadCount });
}
