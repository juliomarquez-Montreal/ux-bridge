import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-helpers";

// POST /api/notifications/read { ids?: string[], all?: boolean } -> marca como
// lidas (sempre só as do usuário logado).
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const ids: string[] = Array.isArray(body.ids) ? body.ids.filter((x: unknown): x is string => typeof x === "string") : [];
  if (!body.all && ids.length === 0) return NextResponse.json({ error: "Informe ids ou all." }, { status: 400 });

  const result = await db.notification.updateMany({
    where: { userId: user.id, read: false, ...(body.all ? {} : { id: { in: ids } }) },
    data: { read: true },
  });
  return NextResponse.json({ updated: result.count });
}
