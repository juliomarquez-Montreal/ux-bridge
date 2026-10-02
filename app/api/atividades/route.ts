import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-helpers";
import { ACTIVITY_ACTIONS } from "@/lib/activity/actions";
import { activityVisibilityWhere } from "@/lib/activity/visibility";

const PAGE_SIZE = 20;

// GET /api/atividades?page=1&action=&userId=&order=desc|asc
// Qualquer usuário autenticado; vê só o que activityVisibilityWhere permite
// (ADMIN vê tudo). Devolve a página pedida, o total e as opções do filtro de
// usuário (quem aparece nas atividades visíveis).
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const params = new URL(request.url).searchParams;
  const action = params.get("action") ?? "";
  const userId = params.get("userId") ?? "";
  const order = params.get("order") === "asc" ? "asc" : "desc";
  const requestedPage = Math.max(1, parseInt(params.get("page") ?? "1", 10) || 1);

  const visibility = await activityVisibilityWhere(user);
  const filters: Prisma.ActivityLogWhereInput[] = [visibility];
  if (action && (ACTIVITY_ACTIONS as readonly string[]).includes(action)) filters.push({ action });
  if (userId) filters.push({ userId });
  const where: Prisma.ActivityLogWhereInput = { AND: filters };

  const total = await db.activityLog.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(requestedPage, totalPages);

  const logs = await db.activityLog.findMany({
    where,
    orderBy: [{ createdAt: order }, { id: order }],
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    include: { user: { select: { id: true, name: true, avatarUrl: true } } },
  });

  // Link só pra itens que ainda existem (um Bridge/Projeto/nó excluído depois
  // continua no histórico, mas sem link).
  const idsOf = (types: string[]) => logs.filter((l) => types.includes(l.entityType)).map((l) => l.entityId);
  const [bridges, projects, nodes] = await Promise.all([
    db.bridge.findMany({ where: { id: { in: idsOf(["BRIDGE", "WIREFRAME"]) } }, select: { id: true } }),
    db.project.findMany({ where: { id: { in: idsOf(["PROJECT"]) } }, select: { id: true } }),
    db.contextNode.findMany({ where: { id: { in: idsOf(["NOVA_NODE"]) } }, select: { id: true } }),
  ]);
  const existing = {
    BRIDGE: new Set(bridges.map((b) => b.id)),
    PROJECT: new Set(projects.map((p) => p.id)),
    NOVA_NODE: new Set(nodes.map((n) => n.id)),
  };

  function linkFor(log: (typeof logs)[number]): string | null {
    if (log.entityType === "BRIDGE" || log.entityType === "WIREFRAME") {
      return existing.BRIDGE.has(log.entityId) ? `/bridges/${log.entityId}` : null;
    }
    if (log.entityType === "PROJECT") return existing.PROJECT.has(log.entityId) ? `/projetos/${log.entityId}` : null;
    if (log.entityType === "NOVA_NODE") return existing.NOVA_NODE.has(log.entityId) ? "/nova" : null;
    return null;
  }

  const userRows = await db.activityLog.findMany({ where: visibility, distinct: ["userId"], select: { userId: true } });
  const users = await db.user.findMany({
    where: { id: { in: userRows.map((r) => r.userId) } },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({
    items: logs.map((log) => ({
      id: log.id,
      action: log.action,
      entityType: log.entityType,
      entityLabel: log.entityLabel,
      metadata: log.metadata,
      createdAt: log.createdAt,
      user: log.user,
      link: linkFor(log),
    })),
    total,
    page,
    totalPages,
    pageSize: PAGE_SIZE,
    users,
  });
}
