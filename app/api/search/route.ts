import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-helpers";
import { getUserGalaxyIds } from "@/lib/nova/permissions";

const LIMIT = 5;

// GET /api/search?q=texto -> busca do header (Ctrl+K) em Bridges (por nome do
// Planeta/Estrela/Galáxia), Projetos (nome/código) e nós da NOVA (nome). Bridges
// e nós respeitam a permissão de Galáxia (ADMIN vê tudo); Projetos são de
// leitura aberta a qualquer usuário autenticado, como na listagem /projetos.
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const q = (new URL(request.url).searchParams.get("q") ?? "").trim();
  if (q.length < 2) return NextResponse.json({ bridges: [], projects: [], nodes: [] });

  const like = { contains: q, mode: "insensitive" as const };
  const isAdmin = user.permissionLevel === "ADMIN";
  const galaxyIds = isAdmin ? [] : await getUserGalaxyIds(user);

  const bridgeWhere: Prisma.BridgeWhereInput = {
    AND: [
      isAdmin ? {} : { planet: { parent: { parentId: { in: galaxyIds } } } },
      {
        OR: [
          { planet: { name: like } },
          { planet: { parent: { name: like } } },
          { planet: { parent: { parent: { name: like } } } },
        ],
      },
    ],
  };

  // Nó visível: Universo (sempre), a própria Galáxia, ou Estrela/Planeta dentro
  // de uma Galáxia do usuário.
  const nodeWhere: Prisma.ContextNodeWhereInput = {
    AND: [
      { name: like },
      isAdmin
        ? {}
        : {
            OR: [
              { type: "UNIVERSO" },
              { id: { in: galaxyIds } },
              { type: "ESTRELA", parentId: { in: galaxyIds } },
              { type: "PLANETA", parent: { parentId: { in: galaxyIds } } },
            ],
          },
    ],
  };

  const [bridges, projects, nodes] = await Promise.all([
    db.bridge.findMany({
      where: bridgeWhere,
      orderBy: { createdAt: "desc" },
      take: LIMIT,
      select: {
        id: true,
        status: true,
        planet: { select: { name: true, parent: { select: { name: true, parent: { select: { name: true } } } } } },
      },
    }),
    db.project.findMany({
      where: { OR: [{ name: like }, { code: like }] },
      orderBy: { createdAt: "desc" },
      take: LIMIT,
      select: { id: true, name: true, code: true },
    }),
    db.contextNode.findMany({
      where: nodeWhere,
      orderBy: { name: "asc" },
      take: LIMIT,
      select: { id: true, name: true, type: true, parent: { select: { name: true } } },
    }),
  ]);

  return NextResponse.json({
    bridges: bridges.map((b) => ({
      id: b.id,
      title: b.planet.name,
      subtitle: [b.planet.parent?.parent?.name, b.planet.parent?.name].filter(Boolean).join(" / "),
      status: b.status,
    })),
    projects: projects.map((p) => ({ id: p.id, title: p.name, subtitle: p.code })),
    nodes: nodes.map((n) => ({ id: n.id, title: n.name, type: n.type, subtitle: n.parent?.name ?? null })),
  });
}
