import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-helpers";
import { BRIDGE_WITH_PLANET_INCLUDE } from "@/lib/bridges/include";

// GET /api/bridges/:id/shared -> versão somente-leitura do Bridge, acessível
// a QUALQUER usuário autenticado no sistema (link de compartilhar, ícone na
// tela /bridges) — de propósito NÃO chama canAccessBridgeForPlanet, que
// restringe por Galáxia: o ponto do link é justamente poder ser aberto por
// alguém fora da Galáxia/Universo do Bridge. Usado por app/bridges/[id]/
// share/page.tsx.
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const bridge = await db.bridge.findUnique({ where: { id: params.id }, include: BRIDGE_WITH_PLANET_INCLUDE });
  if (!bridge) return NextResponse.json({ error: "Bridge não encontrado." }, { status: 404 });

  return NextResponse.json({ bridge });
}
