import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-helpers";
import { canAccessBridgeForPlanet, canEditWireframeContent } from "@/lib/nova/permissions";

interface Params {
  params: { id: string };
}

// GET /api/bridges/:id/annotations -> lista os traços de desenho livre
// (ferramenta Caneta, Wireframe-1b) de um Bridge. Carregado à parte do
// wireframeData.blocks porque não é um componente de interface estruturado.
export async function GET(_request: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const bridge = await db.bridge.findUnique({ where: { id: params.id }, select: { planetContextNodeId: true } });
  if (!bridge) return NextResponse.json({ error: "Bridge não encontrado." }, { status: 404 });

  const permission = await canAccessBridgeForPlanet({ planetId: bridge.planetContextNodeId, user });
  if (!permission.allowed) return NextResponse.json({ error: permission.reason }, { status: 403 });

  const annotations = await db.wireframeAnnotation.findMany({
    where: { bridgeId: params.id },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({ annotations });
}

// POST /api/bridges/:id/annotations -> cria um traço novo (ferramenta Caneta
// solta o mouse). pathData já vem pronto em formato "M x y L x y ..." do
// editor — o servidor só valida que é uma string não vazia, sem parsear
// (o path é gerado inteiramente no client a partir dos pontos do mouse).
export async function POST(request: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const bridge = await db.bridge.findUnique({ where: { id: params.id }, select: { planetContextNodeId: true, status: true, uxUserId: true } });
  if (!bridge) return NextResponse.json({ error: "Bridge não encontrado." }, { status: 404 });

  const permission = await canAccessBridgeForPlanet({ planetId: bridge.planetContextNodeId, user });
  if (!permission.allowed) return NextResponse.json({ error: permission.reason }, { status: 403 });

  if (!canEditWireframeContent(bridge, user)) {
    return NextResponse.json({ error: "Você não tem permissão para editar o Wireframe neste momento." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const pathData = typeof body.pathData === "string" ? body.pathData.trim() : "";
  if (!pathData) return NextResponse.json({ error: "pathData é obrigatório." }, { status: 400 });
  const color = typeof body.color === "string" && body.color.trim() ? body.color.trim() : "#94a3b8";

  const annotation = await db.wireframeAnnotation.create({
    data: { bridgeId: params.id, pathData, color },
  });
  return NextResponse.json({ annotation });
}
