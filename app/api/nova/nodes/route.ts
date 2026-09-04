import { NextResponse } from "next/server";
import type { ContextNode, ContextNodeType } from "@prisma/client";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-helpers";
import { canCreateNode, EXPECTED_PARENT_TYPE } from "@/lib/nova/permissions";

const VALID_TYPES: ContextNodeType[] = ["UNIVERSO", "GALAXIA", "ESTRELA", "PLANETA"];

interface TreeNode extends ContextNode {
  children: TreeNode[];
}

function buildTree(nodes: ContextNode[]): TreeNode[] {
  const byId = new Map<string, TreeNode>(nodes.map((n) => [n.id, { ...n, children: [] }]));
  const roots: TreeNode[] = [];

  for (const node of Array.from(byId.values())) {
    if (node.parentId && byId.has(node.parentId)) {
      byId.get(node.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

// GET /api/nova/nodes            -> árvore completa (todos os Universos e descendentes)
// GET /api/nova/nodes?parentId=x -> só os filhos diretos de x (navegação em árvore)
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const parentId = new URL(request.url).searchParams.get("parentId");

  if (parentId) {
    const children = await db.contextNode.findMany({ where: { parentId }, orderBy: { name: "asc" } });
    return NextResponse.json({ nodes: children });
  }

  const allNodes = await db.contextNode.findMany({ orderBy: { name: "asc" } });
  return NextResponse.json({ tree: buildTree(allNodes) });
}

// POST /api/nova/nodes -> cria Universo/Galáxia/Estrela/Planeta, validando
// tipo, estrutura (pai do tipo certo) e permissão antes de gravar.
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const type = body.type as ContextNodeType | undefined;
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const parentId = typeof body.parentId === "string" ? body.parentId : null;
  const planetTypeId = typeof body.planetTypeId === "string" ? body.planetTypeId : null;

  if (!type || !VALID_TYPES.includes(type)) {
    return NextResponse.json({ error: "type inválido. Use: UNIVERSO | GALAXIA | ESTRELA | PLANETA." }, { status: 400 });
  }
  if (!name) {
    return NextResponse.json({ error: "name é obrigatório." }, { status: 400 });
  }

  const expectedParentType = EXPECTED_PARENT_TYPE[type];

  if (expectedParentType === null) {
    if (parentId) {
      return NextResponse.json({ error: "UNIVERSO não pode ter um nó pai." }, { status: 400 });
    }
  } else {
    if (!parentId) {
      return NextResponse.json({ error: `${type} precisa de um parentId (do tipo ${expectedParentType}).` }, { status: 400 });
    }
    const parent = await db.contextNode.findUnique({ where: { id: parentId } });
    if (!parent) {
      return NextResponse.json({ error: "Nó pai não encontrado." }, { status: 404 });
    }
    if (parent.type !== expectedParentType) {
      return NextResponse.json(
        { error: `${type} só pode ser filho de ${expectedParentType} (o pai informado é ${parent.type}).` },
        { status: 400 }
      );
    }
  }

  // Planeta sempre precisa de um PlanetType válido.
  if (type === "PLANETA") {
    if (!planetTypeId) {
      return NextResponse.json({ error: "planetTypeId é obrigatório para criar um Planeta." }, { status: 400 });
    }
    const planetType = await db.planetType.findUnique({ where: { id: planetTypeId } });
    if (!planetType) {
      return NextResponse.json({ error: "planetTypeId não corresponde a um tipo de Planeta existente." }, { status: 400 });
    }
  } else if (planetTypeId) {
    return NextResponse.json({ error: "planetTypeId só é válido para type=PLANETA." }, { status: 400 });
  }

  const permission = await canCreateNode({ type, parentId, user });
  if (!permission.allowed) {
    return NextResponse.json({ error: permission.reason }, { status: 403 });
  }

  const created = await db.contextNode.create({
    data: { type, name, parentId, planetTypeId: type === "PLANETA" ? planetTypeId : null },
  });

  return NextResponse.json({ node: created }, { status: 201 });
}
