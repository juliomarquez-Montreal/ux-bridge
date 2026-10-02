import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-helpers";
import { canManageProject } from "@/lib/projects/permissions";

interface Params {
  params: { id: string };
}

// GET /api/projetos/:id/specs?ids=a,b,c -> Bridge Specs completos dos
// Bridges pedidos (só os vinculados a este Projeto), pro Comparador lado a
// lado. Exige ser da equipe do Projeto (o texto do Spec é mais sensível que
// o resumo do Projeto).
export async function GET(request: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const permission = await canManageProject({ projectId: params.id, user });
  if (!permission.allowed) return NextResponse.json({ error: permission.reason }, { status: 403 });

  const ids = (new URL(request.url).searchParams.get("ids") ?? "").split(",").filter(Boolean);
  if (ids.length === 0) return NextResponse.json({ specs: [] });

  const links = await db.projectBridgeLink.findMany({
    where: { projectId: params.id, bridgeId: { in: ids } },
    select: { bridge: { select: { id: true, generatedBddPbi: true, planet: { select: { name: true } } } } },
  });

  return NextResponse.json({
    specs: links.map((l) => ({ bridgeId: l.bridge.id, name: l.bridge.planet.name, spec: l.bridge.generatedBddPbi })),
  });
}
