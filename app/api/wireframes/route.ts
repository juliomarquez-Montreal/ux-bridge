import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-helpers";
import { getUserGalaxyIds } from "@/lib/nova/permissions";

const PAGE_SIZE = 15;

// Status em que o Bridge já tem Wireframe pronto pra mostrar. GERANDO_WIREFRAME
// fica de fora de propósito: ainda não existe nada pra ver/baixar.
const STATUSES_WITH_WIREFRAME = ["AGUARDANDO_APROVACAO_WIREFRAME_PO", "AGUARDANDO_APROVACAO_UX", "FINALIZADO"];

// GET /api/wireframes?page=1&q=texto -> Wireframes (Bridges com Wireframe
// gerado) das Galáxias às quais o usuário tem acesso (ADMIN: todos), com busca
// por nome do Planeta/Galáxia e paginação. Planeta -> Estrela -> Galáxia.
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const params = new URL(request.url).searchParams;
  const q = (params.get("q") ?? "").trim();
  const requestedPage = Math.max(1, parseInt(params.get("page") ?? "1", 10) || 1);

  const filters: Prisma.BridgeWhereInput[] = [{ status: { in: STATUSES_WITH_WIREFRAME } }];
  if (user.permissionLevel !== "ADMIN") {
    const galaxyIds = await getUserGalaxyIds(user);
    filters.push({ planet: { parent: { parentId: { in: galaxyIds } } } });
  }
  if (q) {
    filters.push({
      OR: [
        { planet: { name: { contains: q, mode: "insensitive" } } },
        { planet: { parent: { parent: { name: { contains: q, mode: "insensitive" } } } } },
      ],
    });
  }
  const where: Prisma.BridgeWhereInput = { AND: filters };

  const total = await db.bridge.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(requestedPage, totalPages);

  const bridges = await db.bridge.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    select: {
      id: true,
      status: true,
      createdAt: true,
      createdById: true,
      wireframeExportUrl: true,
      planet: { select: { name: true, parent: { select: { name: true, parent: { select: { name: true } } } } } },
    },
  });

  // Bridge.createdById é só um scalar (sem relação formal com User): resolve
  // os nomes num segundo select, igual a GET /api/bridges.
  const creators = await db.user.findMany({
    where: { id: { in: Array.from(new Set(bridges.map((b) => b.createdById))) } },
    select: { id: true, name: true },
  });
  const creatorName = new Map(creators.map((c) => [c.id, c.name]));

  return NextResponse.json({
    items: bridges.map((b) => ({
      bridgeId: b.id,
      planetName: b.planet.name,
      galaxyName: b.planet.parent?.parent?.name ?? null,
      status: b.status,
      createdBy: creatorName.get(b.createdById) ?? "—",
      createdAt: b.createdAt,
      // SVG exportado pelo UX (Wireframe-2), se já existir; senão o botão de
      // download usa a renderização atual (…/shared/svg?download=1).
      exportUrl: b.wireframeExportUrl,
    })),
    total,
    page,
    totalPages,
    pageSize: PAGE_SIZE,
  });
}
