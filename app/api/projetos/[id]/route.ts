import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-helpers";
import { canManageProject } from "@/lib/projects/permissions";
import { logActivity } from "@/lib/activity/logActivity";

interface Params {
  params: { id: string };
}

// GET /api/projetos/:id -> detalhe completo: Bridges vinculados (com
// Planeta/Estrela/Galáxia resolvidos), membros (com nome/avatar), sprints e
// decisões. Qualquer usuário autenticado pode ver (mesmo padrão de leitura
// aberta da listagem).
export async function GET(_request: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const project = await db.project.findUnique({
    where: { id: params.id },
    include: {
      bridgeLinks: {
        // id como desempate: vínculos criados em lote têm o mesmo linkedAt, e
        // sem isso a ordem das linhas mudava a cada recarga.
        orderBy: [{ linkedAt: "asc" }, { id: "asc" }],
        include: {
          bridge: {
            select: {
              id: true,
              status: true,
              bddApprovedAt: true,
              generatedBddPbi: true,
              createdAt: true,
              planet: {
                select: { name: true, parent: { select: { name: true, parent: { select: { name: true } } } } },
              },
            },
          },
        },
      },
      members: { orderBy: { addedAt: "asc" } },
      sprints: { orderBy: { startDate: "asc" } },
      decisions: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!project) return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 });

  const memberIds = project.members.map((m) => m.userId);
  const decisionAuthorIds = project.decisions.map((d) => d.authorId);
  const creatorAndAuthorIds = Array.from(new Set([project.createdById, ...memberIds, ...decisionAuthorIds]));
  const users = await db.user.findMany({ where: { id: { in: creatorAndAuthorIds } }, select: { id: true, name: true, avatarUrl: true } });
  const userById = new Map(users.map((u) => [u.id, u]));

  return NextResponse.json({
    project: {
      id: project.id,
      code: project.code,
      name: project.name,
      objective: project.objective,
      status: project.status,
      createdById: project.createdById,
      createdByName: userById.get(project.createdById)?.name ?? "—",
      createdAt: project.createdAt,
      bridgeCount: project.bridgeLinks.length,
      bridges: project.bridgeLinks.map((link) => ({
        id: link.bridge.id,
        status: link.bridge.status,
        bddApprovedAt: link.bridge.bddApprovedAt,
        createdAt: link.bridge.createdAt,
        planetName: link.bridge.planet.name,
        estrelaName: link.bridge.planet.parent?.name ?? null,
        galaxiaName: link.bridge.planet.parent?.parent?.name ?? null,
        linkedAt: link.linkedAt,
        area: link.area,
        hasSpec: !!link.bridge.generatedBddPbi,
      })),
      members: project.members.map((m) => ({
        id: m.id,
        userId: m.userId,
        name: userById.get(m.userId)?.name ?? "—",
        avatarUrl: userById.get(m.userId)?.avatarUrl ?? null,
        role: m.role,
        addedAt: m.addedAt,
      })),
      sprints: project.sprints,
      decisions: project.decisions.map((d) => ({
        id: d.id,
        text: d.text,
        authorId: d.authorId,
        authorName: userById.get(d.authorId)?.name ?? "—",
        createdAt: d.createdAt,
      })),
    },
  });
}

// PATCH /api/projetos/:id -> edita campos simples do Projeto (name,
// objective, status) — usado pelo "Editar" do card de objetivo e pelo
// seletor de status no cabeçalho.
export async function PATCH(request: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const permission = await canManageProject({ projectId: params.id, user });
  if (!permission.allowed) return NextResponse.json({ error: permission.reason }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const data: { name?: string; objective?: string | null; status?: string } = {};

  if (typeof body.name === "string") {
    if (!body.name.trim()) return NextResponse.json({ error: "Nome do Projeto não pode ficar vazio." }, { status: 400 });
    data.name = body.name.trim();
  }
  if (typeof body.objective === "string") {
    data.objective = body.objective.trim() || null;
  }
  if (typeof body.status === "string") {
    const validStatuses = ["PLANEJAMENTO", "EM_EXECUCAO", "EM_VALIDACAO", "FINALIZADO"];
    if (!validStatuses.includes(body.status)) {
      return NextResponse.json({ error: "Status inválido." }, { status: 400 });
    }
    data.status = body.status;
  }

  const project = await db.project.update({ where: { id: params.id }, data });
  return NextResponse.json({ project });
}

// DELETE /api/projetos/:id?mode=keep|delete -> exclui o Projeto inteiro.
// mode=keep (padrão): remove só os ProjectBridgeLink, os Bridges continuam
// existindo soltos. mode=delete: apaga os Bridges vinculados também (ação
// destrutiva, confirmação extra já feita no client antes de chamar aqui).
export async function DELETE(request: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const permission = await canManageProject({ projectId: params.id, user });
  if (!permission.allowed) return NextResponse.json({ error: permission.reason }, { status: 403 });

  const mode = new URL(request.url).searchParams.get("mode") === "delete" ? "delete" : "keep";
  const target = await db.project.findUnique({ where: { id: params.id }, select: { name: true, code: true } });

  if (mode === "delete") {
    const links = await db.projectBridgeLink.findMany({ where: { projectId: params.id }, select: { bridgeId: true } });
    await db.bridge.deleteMany({ where: { id: { in: links.map((l) => l.bridgeId) } } });
  }

  // ProjectBridgeLink (se ainda houver, no modo "keep"), ProjectMember,
  // ProjectSprint e ProjectDecision têm onDelete: Cascade em projectId —
  // excluir o Project já limpa tudo isso junto.
  await db.project.delete({ where: { id: params.id } });

  await logActivity({
    userId: user.id,
    action: "PROJECT_DELETED",
    entityType: "PROJECT",
    entityId: params.id,
    entityLabel: target?.name ?? "Projeto",
    metadata: { code: target?.code ?? null, mode },
  });

  return NextResponse.json({ ok: true });
}
