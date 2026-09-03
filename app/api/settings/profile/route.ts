import { NextResponse } from "next/server";
import type { Funcao } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth-helpers";
import { db } from "@/lib/db";

const VALID_FUNCOES: Funcao[] = ["PO", "UX", "GERENTE_PROJETOS", "OUTROS"];

const PROFILE_SELECT = {
  id: true,
  name: true,
  email: true,
  funcao: true,
  permissionLevel: true,
  avatarUrl: true,
} as const;

// GET/PATCH sempre operam sobre o usuário da sessão — nunca um id vindo do
// cliente, pra ninguém conseguir ler/editar o perfil de outra pessoa por aqui.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const profile = await db.user.findUnique({ where: { id: user.id }, select: PROFILE_SELECT });
  if (!profile) return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });

  return NextResponse.json({ user: profile });
}

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const data: { name?: string; funcao?: Funcao } = {};

  if (typeof body.name === "string") {
    const name = body.name.trim();
    if (!name) return NextResponse.json({ error: "Nome não pode ficar vazio." }, { status: 400 });
    data.name = name;
  }

  if (typeof body.funcao === "string") {
    if (!VALID_FUNCOES.includes(body.funcao as Funcao)) {
      return NextResponse.json({ error: "Função inválida." }, { status: 400 });
    }
    data.funcao = body.funcao as Funcao;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nada para atualizar." }, { status: 400 });
  }

  const updated = await db.user.update({ where: { id: user.id }, data, select: PROFILE_SELECT });

  return NextResponse.json({ user: updated });
}
