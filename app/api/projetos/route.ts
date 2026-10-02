import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-helpers";
import { canAccessBridgeForPlanet } from "@/lib/nova/permissions";

// Gera o próximo código sequencial "PRJ-XXX" (3 dígitos, cresce além disso
// sem quebrar). Tenta algumas vezes em caso de corrida rara entre duas
// criações simultâneas (o @@unique em Project.code garante que nunca
// duplica, só precisa tentar de novo com o próximo número).
async function generateProjectCode(): Promise<string> {
  const count = await db.project.count();
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = `PRJ-${String(count + 1 + attempt).padStart(3, "0")}`;
    const exists = await db.project.findUnique({ where: { code: candidate }, select: { id: true } });
    if (!exists) return candidate;
  }
  // Fallback improvável (5 colisões seguidas) — garante unicidade com um sufixo.
  return `PRJ-${Date.now()}`;
}

// GET /api/projetos -> lista todos os Projetos (qualquer usuário autenticado
// pode ver, mesmo padrão de leitura aberta já usado em outras listagens
// internas desta ferramenta — ex: Design System). Contagem de Bridges
// vinculados via _count, sem puxar os Bridges inteiros (isso só na rota de
// detalhe).
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const projects = await db.project.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { bridgeLinks: true } }, members: { select: { userId: true } } },
  });

  const creatorIds = Array.from(new Set(projects.map((p) => p.createdById)));
  const creators = await db.user.findMany({ where: { id: { in: creatorIds } }, select: { id: true, name: true } });
  const creatorNameById = new Map(creators.map((c) => [c.id, c.name]));

  return NextResponse.json({
    projects: projects.map((p) => ({
      id: p.id,
      code: p.code,
      name: p.name,
      objective: p.objective,
      status: p.status,
      createdById: p.createdById,
      createdByName: creatorNameById.get(p.createdById) ?? "—",
      createdAt: p.createdAt,
      bridgeCount: p._count.bridgeLinks,
      // Mesma regra de canManageProject (ADMIN, criador ou membro) — usada pela
      // tabela pra só oferecer "Apagar" a quem realmente pode.
      canManage: user.permissionLevel === "ADMIN" || p.createdById === user.id || p.members.some((m) => m.userId === user.id),
    })),
  });
}

// POST /api/projetos -> cria um Projeto novo. Body: { name, objective?,
// bridgeIds: string[] } — pelo menos um Bridge obrigatório (o Projeto nasce
// já com Bridges vinculados, ver instrução do Projeto-1). Cada bridgeId
// precisa: existir, não estar vinculado a nenhum outro Projeto, e o usuário
// precisa ter acesso à Galáxia daquele Bridge (canAccessBridgeForPlanet) —
// qualquer usuário autenticado pode criar um Projeto.
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const objective = typeof body.objective === "string" && body.objective.trim() ? body.objective.trim() : null;
  const bridgeIds: unknown = body.bridgeIds;

  if (!name) return NextResponse.json({ error: "Nome do Projeto é obrigatório." }, { status: 400 });
  if (!Array.isArray(bridgeIds) || bridgeIds.length === 0 || !bridgeIds.every((id) => typeof id === "string")) {
    return NextResponse.json({ error: "Selecione ao menos um Bridge para vincular ao Projeto." }, { status: 400 });
  }

  const bridges = await db.bridge.findMany({
    where: { id: { in: bridgeIds } },
    select: { id: true, planetContextNodeId: true, projectLink: { select: { id: true } } },
  });
  if (bridges.length !== bridgeIds.length) {
    return NextResponse.json({ error: "Um ou mais Bridges selecionados não foram encontrados." }, { status: 404 });
  }
  const alreadyLinked = bridges.find((b) => b.projectLink);
  if (alreadyLinked) {
    return NextResponse.json({ error: "Um ou mais Bridges selecionados já pertencem a outro Projeto." }, { status: 409 });
  }
  for (const bridge of bridges) {
    const permission = await canAccessBridgeForPlanet({ planetId: bridge.planetContextNodeId, user });
    if (!permission.allowed) return NextResponse.json({ error: permission.reason }, { status: 403 });
  }

  const code = await generateProjectCode();

  const project = await db.project.create({
    data: {
      code,
      name,
      objective,
      status: "PLANEJAMENTO",
      createdById: user.id,
      bridgeLinks: {
        create: bridgeIds.map((bridgeId) => ({ bridgeId, linkedById: user.id })),
      },
    },
  });

  return NextResponse.json({ project }, { status: 201 });
}
