import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-helpers";
import { getUserGalaxyIds } from "@/lib/nova/permissions";
import { fuzzyScore } from "@/lib/search/fuzzy";

const LIMIT = 5;
// Teto de candidatos lidos por tipo (a busca aproximada roda em memória).
const CANDIDATE_CAP = 2000;

function topMatches<T>(items: T[], score: (item: T) => number): T[] {
  return items
    .map((item) => ({ item, score: score(item) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, LIMIT)
    .map((entry) => entry.item);
}

// GET /api/search?q=texto -> busca aproximada (sem acento, trecho no meio da
// palavra, erros leves de digitação) em Bridges (nome do Planeta/Estrela/
// Galáxia), Projetos (nome/código) e nós da NOVA (nome). Bridges e nós
// respeitam a permissão de Galáxia (ADMIN vê tudo); Projetos são de leitura
// aberta a qualquer usuário autenticado, como na listagem /projetos. As
// páginas/ações fixas do sistema vêm do índice estático
// (lib/search/staticIndex.ts), mesclado no client.
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const q = (new URL(request.url).searchParams.get("q") ?? "").trim();
  if (q.length < 2) return NextResponse.json({ bridges: [], projects: [], nodes: [] });

  const isAdmin = user.permissionLevel === "ADMIN";
  const galaxyIds = isAdmin ? [] : await getUserGalaxyIds(user);

  const bridgeWhere: Prisma.BridgeWhereInput = isAdmin ? {} : { planet: { parent: { parentId: { in: galaxyIds } } } };
  // Nó visível: Universo (sempre), a própria Galáxia, ou Estrela/Planeta dentro
  // de uma Galáxia do usuário.
  const nodeWhere: Prisma.ContextNodeWhereInput = isAdmin
    ? {}
    : {
        OR: [
          { type: "UNIVERSO" },
          { id: { in: galaxyIds } },
          { type: "ESTRELA", parentId: { in: galaxyIds } },
          { type: "PLANETA", parent: { parentId: { in: galaxyIds } } },
        ],
      };

  const [bridges, projects, nodes] = await Promise.all([
    db.bridge.findMany({
      where: bridgeWhere,
      orderBy: { createdAt: "desc" },
      take: CANDIDATE_CAP,
      select: {
        id: true,
        status: true,
        planet: { select: { name: true, parent: { select: { name: true, parent: { select: { name: true } } } } } },
      },
    }),
    db.project.findMany({ orderBy: { createdAt: "desc" }, take: CANDIDATE_CAP, select: { id: true, name: true, code: true } }),
    db.contextNode.findMany({
      where: nodeWhere,
      orderBy: { name: "asc" },
      take: CANDIDATE_CAP,
      select: { id: true, name: true, type: true, parent: { select: { name: true } } },
    }),
  ]);

  return NextResponse.json({
    bridges: topMatches(bridges, (b) =>
      Math.max(
        fuzzyScore(q, b.planet.name),
        0.7 * fuzzyScore(q, b.planet.parent?.name ?? ""),
        0.7 * fuzzyScore(q, b.planet.parent?.parent?.name ?? "")
      )
    ).map((b) => ({
      id: b.id,
      title: b.planet.name,
      subtitle: [b.planet.parent?.parent?.name, b.planet.parent?.name].filter(Boolean).join(" / "),
      status: b.status,
    })),
    projects: topMatches(projects, (p) => Math.max(fuzzyScore(q, p.name), fuzzyScore(q, p.code))).map((p) => ({
      id: p.id,
      title: p.name,
      subtitle: p.code,
    })),
    nodes: topMatches(nodes, (n) => fuzzyScore(q, n.name)).map((n) => ({
      id: n.id,
      title: n.name,
      type: n.type,
      subtitle: n.parent?.name ?? null,
    })),
  });
}
