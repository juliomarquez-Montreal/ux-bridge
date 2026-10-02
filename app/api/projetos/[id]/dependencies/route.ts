import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-helpers";
import { canManageProject } from "@/lib/projects/permissions";

interface Params {
  params: { id: string };
}

// POST /api/projetos/:id/dependencies -> declara "bridgeId depende de
// dependsOnBridgeId" ({ bridgeId, dependsOnBridgeId, note? }). Valida: os
// dois Bridges estão vinculados a ESTE Projeto, não é auto-dependência, não
// repete e não fecha ciclo (A->B quando B->A, ou qualquer volta mais longa
// A->B->C->A — seguimos as dependências de dependsOnBridgeId até achar
// bridgeId).
export async function POST(request: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const permission = await canManageProject({ projectId: params.id, user });
  if (!permission.allowed) return NextResponse.json({ error: permission.reason }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const bridgeId = typeof body.bridgeId === "string" ? body.bridgeId : "";
  const dependsOnBridgeId = typeof body.dependsOnBridgeId === "string" ? body.dependsOnBridgeId : "";
  const note = typeof body.note === "string" && body.note.trim() ? body.note.trim() : null;

  if (!bridgeId || !dependsOnBridgeId) {
    return NextResponse.json({ error: "Selecione os dois Bridges." }, { status: 400 });
  }
  if (bridgeId === dependsOnBridgeId) {
    return NextResponse.json({ error: "Um Bridge não pode depender de si mesmo." }, { status: 400 });
  }

  const links = await db.projectBridgeLink.findMany({
    where: { projectId: params.id, bridgeId: { in: [bridgeId, dependsOnBridgeId] } },
    select: { bridgeId: true },
  });
  if (links.length !== 2) {
    return NextResponse.json({ error: "Os dois Bridges precisam estar vinculados a este Projeto." }, { status: 400 });
  }

  const existing = await db.bridgeDependency.findMany({ where: { projectId: params.id } });
  if (existing.some((d) => d.bridgeId === bridgeId && d.dependsOnBridgeId === dependsOnBridgeId)) {
    return NextResponse.json({ error: "Essa dependência já foi declarada." }, { status: 409 });
  }
  if (existing.some((d) => d.bridgeId === dependsOnBridgeId && d.dependsOnBridgeId === bridgeId)) {
    return NextResponse.json(
      { error: "Dependência circular: o outro Bridge já depende deste. Remova a dependência existente primeiro." },
      { status: 400 }
    );
  }

  // Ciclo mais longo: de dependsOnBridgeId, seguindo "depende de", dá pra chegar em bridgeId?
  const dependsOn = new Map<string, string[]>();
  for (const d of existing) dependsOn.set(d.bridgeId, [...(dependsOn.get(d.bridgeId) ?? []), d.dependsOnBridgeId]);
  const stack = [dependsOnBridgeId];
  const seen = new Set<string>();
  while (stack.length > 0) {
    const current = stack.pop()!;
    if (current === bridgeId) {
      return NextResponse.json(
        { error: "Dependência circular: essa dependência fecharia um ciclo entre os Bridges." },
        { status: 400 }
      );
    }
    if (seen.has(current)) continue;
    seen.add(current);
    stack.push(...(dependsOn.get(current) ?? []));
  }

  const dependency = await db.bridgeDependency.create({
    data: { projectId: params.id, bridgeId, dependsOnBridgeId, note, createdById: user.id },
  });
  return NextResponse.json({ dependency }, { status: 201 });
}
