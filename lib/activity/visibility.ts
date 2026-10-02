import type { Prisma } from "@prisma/client";
import { getUserGalaxyIds, type PermissionUser } from "@/lib/nova/permissions";

// Quais registros de ActivityLog o usuário pode ver em /atividades:
// - ADMIN: tudo.
// - Demais: registros das Galáxias às quais tem acesso (UserGalaxyAccess) +
//   registros sem Galáxia (galaxyId null: Projetos — que já são de leitura
//   aberta a qualquer usuário autenticado — e o nível Universo).
export async function activityVisibilityWhere(user: PermissionUser): Promise<Prisma.ActivityLogWhereInput> {
  if (user.permissionLevel === "ADMIN") return {};
  const galaxyIds = await getUserGalaxyIds(user);
  return { OR: [{ galaxyId: null }, { galaxyId: { in: galaxyIds } }] };
}
