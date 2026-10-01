import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-helpers";
import { getUserGalaxyIds } from "@/lib/nova/permissions";

// GET /api/projetos/available-bridges -> Bridges ainda sem Projeto
// (projectLink null), que o usuário pode ver (ADMIN vê todos; usuário comum
// só os das Galáxias às quais tem acesso) — pro seletor de "Vincular Bridge"
// (na criação de um Projeto, dentro de um Projeto existente, e no "Converter
// em Projeto" de /bridges).
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const galaxyIds = user.permissionLevel === "ADMIN" ? null : await getUserGalaxyIds(user);
  if (galaxyIds !== null && galaxyIds.length === 0) {
    return NextResponse.json({ bridges: [] });
  }

  const bridges = await db.bridge.findMany({
    where: {
      projectLink: null,
      ...(galaxyIds !== null
        ? { planet: { parent: { parent: { id: { in: galaxyIds } } } } }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      status: true,
      createdAt: true,
      planet: { select: { name: true, parent: { select: { name: true, parent: { select: { name: true } } } } } },
    },
  });

  return NextResponse.json({
    bridges: bridges.map((bridge) => ({
      id: bridge.id,
      status: bridge.status,
      createdAt: bridge.createdAt,
      planetName: bridge.planet.name,
      estrelaName: bridge.planet.parent?.name ?? null,
      galaxiaName: bridge.planet.parent?.parent?.name ?? null,
    })),
  });
}
