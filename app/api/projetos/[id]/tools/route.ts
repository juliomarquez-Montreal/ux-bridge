import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-helpers";

interface Params {
  params: { id: string };
}

// GET /api/projetos/:id/tools -> tudo que as 5 Ferramentas do PO já
// guardaram: último veredito do Radar por Bridge, última análise de
// conflitos, dependências declaradas e anotações de comparação (com nome do
// autor). Leitura aberta a qualquer usuário autenticado (mesmo padrão do
// detalhe do Projeto); quem RODA IA ou altera precisa ser da equipe.
export async function GET(_request: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const project = await db.project.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      scopeAnalyses: { orderBy: { analyzedAt: "desc" } },
      conflictAnalyses: { orderBy: { analyzedAt: "desc" }, take: 1 },
      bridgeDependencies: { orderBy: { createdAt: "asc" } },
      comparisonNotes: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!project) return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 });

  const authorIds = Array.from(
    new Set([...project.bridgeDependencies.map((d) => d.createdById), ...project.comparisonNotes.map((n) => n.authorId)])
  );
  const authors = await db.user.findMany({ where: { id: { in: authorIds } }, select: { id: true, name: true } });
  const nameById = new Map(authors.map((a) => [a.id, a.name]));

  const conflict = project.conflictAnalyses[0] ?? null;

  return NextResponse.json({
    scopeAnalyses: project.scopeAnalyses.map((a) => ({
      bridgeId: a.bridgeId,
      aligned: a.aligned,
      explanation: a.explanation,
      analyzedAt: a.analyzedAt,
    })),
    conflictAnalysis: conflict
      ? { analyzedAt: conflict.analyzedAt, conflicts: conflict.conflicts as unknown as Array<{ bridgeIdA: string; bridgeIdB: string; description: string }> }
      : null,
    dependencies: project.bridgeDependencies.map((d) => ({
      id: d.id,
      bridgeId: d.bridgeId,
      dependsOnBridgeId: d.dependsOnBridgeId,
      note: d.note,
      createdByName: nameById.get(d.createdById) ?? "—",
      createdAt: d.createdAt,
    })),
    comparisonNotes: project.comparisonNotes.map((n) => ({
      id: n.id,
      bridgeIds: n.bridgeIds as unknown as string[],
      note: n.note,
      authorName: nameById.get(n.authorId) ?? "—",
      createdAt: n.createdAt,
    })),
  });
}
