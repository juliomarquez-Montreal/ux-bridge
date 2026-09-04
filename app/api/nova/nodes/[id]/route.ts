import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-helpers";
import { canModifyNode } from "@/lib/nova/permissions";
import { extractStoragePath, getSupabaseAdmin, PLANET_EXAMPLES_BUCKET } from "@/lib/supabase-admin";

interface Params {
  params: { id: string };
}

// GET /api/nova/nodes/:id -> um nó com seus filhos diretos.
export async function GET(_request: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const node = await db.contextNode.findUnique({
    where: { id: params.id },
    include: { children: { orderBy: { name: "asc" } }, planetType: true },
  });
  if (!node) return NextResponse.json({ error: "Nó não encontrado." }, { status: 404 });

  return NextResponse.json({ node });
}

// PATCH /api/nova/nodes/:id -> edita nome (e planetTypeId, se for Planeta).
export async function PATCH(request: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const node = await db.contextNode.findUnique({ where: { id: params.id } });
  if (!node) return NextResponse.json({ error: "Nó não encontrado." }, { status: 404 });

  const permission = await canModifyNode({ nodeId: node.id, nodeType: node.type, user });
  if (!permission.allowed) {
    return NextResponse.json({ error: permission.reason }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const data: { name?: string; planetTypeId?: string | null } = {};

  if (typeof body.name === "string") {
    const name = body.name.trim();
    if (!name) return NextResponse.json({ error: "name não pode ficar vazio." }, { status: 400 });
    data.name = name;
  }

  if (typeof body.planetTypeId === "string") {
    if (node.type !== "PLANETA") {
      return NextResponse.json({ error: "planetTypeId só é válido para nós do tipo PLANETA." }, { status: 400 });
    }
    const planetType = await db.planetType.findUnique({ where: { id: body.planetTypeId } });
    if (!planetType) {
      return NextResponse.json({ error: "planetTypeId não corresponde a um tipo de Planeta existente." }, { status: 400 });
    }
    data.planetTypeId = body.planetTypeId;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nada para atualizar." }, { status: 400 });
  }

  const updated = await db.contextNode.update({ where: { id: node.id }, data });
  return NextResponse.json({ node: updated });
}

// DELETE /api/nova/nodes/:id -> recusa se o nó tiver filhos (sem cascata automática).
export async function DELETE(_request: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const node = await db.contextNode.findUnique({ where: { id: params.id } });
  if (!node) return NextResponse.json({ error: "Nó não encontrado." }, { status: 404 });

  const permission = await canModifyNode({ nodeId: node.id, nodeType: node.type, user });
  if (!permission.allowed) {
    return NextResponse.json({ error: permission.reason }, { status: 403 });
  }

  const childrenCount = await db.contextNode.count({ where: { parentId: node.id } });
  if (childrenCount > 0) {
    return NextResponse.json(
      { error: `Este nó tem ${childrenCount} filho(s). Remova-os primeiro ou use exclusão em cascata (ainda não implementada).` },
      { status: 409 }
    );
  }

  // Exemplos de treino (Fase N4) são anexos do Planeta, não filhos na árvore
  // — não bloqueiam a exclusão, mas os arquivos no Storage precisam ser
  // limpos manualmente antes (os registros no banco vão junto via onDelete:
  // Cascade do schema).
  if (node.type === "PLANETA") {
    const examples = await db.planetExample.findMany({
      where: { contextNodeId: node.id },
      select: { fileUrl: true },
    });
    const paths = examples
      .map((example) => (example.fileUrl ? extractStoragePath(example.fileUrl, PLANET_EXAMPLES_BUCKET) : null))
      .filter((path): path is string => path !== null);
    if (paths.length > 0) {
      const { error } = await getSupabaseAdmin().storage.from(PLANET_EXAMPLES_BUCKET).remove(paths);
      if (error) console.error("Falha ao remover arquivos de exemplos do Storage:", error.message);
    }
  }

  await db.contextNode.delete({ where: { id: node.id } });
  return NextResponse.json({ ok: true });
}
