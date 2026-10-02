import { db } from "@/lib/db";

interface NotifyInput {
  // Possíveis destinatários (ids repetidos, nulos e o próprio autor da ação são descartados).
  userIds: Array<string | null | undefined>;
  // Quem fez a ação — nunca recebe a própria notificação.
  actorId?: string | null;
  type: string;
  title: string;
  body: string;
  linkUrl?: string;
}

// Cria uma notificação interna pra cada destinatário (só contas ativas). Chamada
// nos mesmos pontos de logActivity(). NUNCA lança: notificar é secundário e uma
// falha aqui não pode derrubar a ação principal.
export async function notifyUsers(input: NotifyInput): Promise<void> {
  try {
    const ids = Array.from(new Set(input.userIds.filter((id): id is string => !!id && id !== input.actorId)));
    if (ids.length === 0) return;
    const recipients = await db.user.findMany({ where: { id: { in: ids }, active: true }, select: { id: true } });
    if (recipients.length === 0) return;
    await db.notification.createMany({
      data: recipients.map((r) => ({ userId: r.id, type: input.type, title: input.title, body: input.body, linkUrl: input.linkUrl ?? null })),
    });
  } catch (error) {
    console.error("Falha ao criar notificação:", error);
  }
}

// Todos os ADMIN ativos (acesso a todas as Galáxias).
export async function getAdminIds(): Promise<string[]> {
  const admins = await db.user.findMany({ where: { permissionLevel: "ADMIN", active: true }, select: { id: true } });
  return admins.map((a) => a.id);
}

// Quem tem acesso explícito (UserGalaxyAccess) a uma Galáxia.
export async function getGalaxyAccessUserIds(galaxyId: string): Promise<string[]> {
  const rows = await db.userGalaxyAccess.findMany({ where: { galaxyId }, select: { userId: true } });
  return rows.map((r) => r.userId);
}

// Nome de quem fez a ação (pro texto da notificação).
export async function getUserName(userId: string): Promise<string> {
  const user = await db.user.findUnique({ where: { id: userId }, select: { name: true } });
  return user?.name ?? "Alguém";
}
