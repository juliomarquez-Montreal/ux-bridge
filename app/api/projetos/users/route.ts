import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-helpers";

// GET /api/projetos/users -> lista de usuários do sistema, pro seletor de
// "Adicionar membro" da Equipe do Projeto — mesmo padrão simples já usado em
// /api/bridges/:id/assignable-users (times pequenos, sem filtro extra).
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const users = await db.user.findMany({
    select: { id: true, name: true, avatarUrl: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ users });
}
