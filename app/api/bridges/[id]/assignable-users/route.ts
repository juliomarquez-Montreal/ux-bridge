import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-helpers";
import { canAccessBridgeForPlanet } from "@/lib/nova/permissions";

// GET /api/bridges/:id/assignable-users -> lista de usuários pro dropdown do
// botão "+" (atribuir UX) no subheader do editor de Wireframe. Lista todos os
// usuários do sistema (times pequenos — filtrar por acesso à Galáxia
// adicionaria uma consulta a mais sem ganho real nesta fase), com os de
// função UX primeiro (mais prováveis de serem quem o PO quer atribuir).
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const bridge = await db.bridge.findUnique({ where: { id: params.id }, select: { planetContextNodeId: true } });
  if (!bridge) return NextResponse.json({ error: "Bridge não encontrado." }, { status: 404 });

  const permission = await canAccessBridgeForPlanet({ planetId: bridge.planetContextNodeId, user });
  if (!permission.allowed) return NextResponse.json({ error: permission.reason }, { status: 403 });

  const users = await db.user.findMany({
    select: { id: true, name: true, avatarUrl: true, funcao: true },
    orderBy: { name: "asc" },
  });
  const sorted = [...users].sort((a, b) => (a.funcao === "UX" ? -1 : b.funcao === "UX" ? 1 : 0));

  return NextResponse.json({ users: sorted.map(({ id, name, avatarUrl }) => ({ id, name, avatarUrl })) });
}
