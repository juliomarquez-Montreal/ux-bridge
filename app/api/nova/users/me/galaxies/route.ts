import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-helpers";

// GET /api/nova/users/me/galaxies -> Galáxias que o usuário logado pode
// selecionar no seletor do header (Universo -> Galáxia). ADMIN recebe TODAS
// as Galáxias do sistema, independente de vínculo explícito em
// UserGalaxyAccess; usuário comum recebe só as que tem acesso.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const currentUser = await db.user.findUnique({ where: { id: user.id }, select: { currentGalaxyId: true } });

  const galaxyNodes =
    user.permissionLevel === "ADMIN"
      ? await db.contextNode.findMany({
          where: { type: "GALAXIA" },
          include: { parent: { select: { id: true, name: true } } },
          orderBy: { name: "asc" },
        })
      : (
          await db.userGalaxyAccess.findMany({
            where: { userId: user.id },
            include: { galaxy: { include: { parent: { select: { id: true, name: true } } } } },
          })
        ).map((access) => access.galaxy);

  const galaxies = galaxyNodes
    .filter((node) => node.parent)
    .map((node) => ({
      id: node.id,
      name: node.name,
      universoId: node.parent!.id,
      universoName: node.parent!.name,
    }))
    .sort((a, b) => a.universoName.localeCompare(b.universoName, "pt-BR") || a.name.localeCompare(b.name, "pt-BR"));

  return NextResponse.json({ galaxies, currentGalaxyId: currentUser?.currentGalaxyId ?? null });
}
