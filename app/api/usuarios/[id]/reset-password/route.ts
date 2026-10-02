import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth-helpers";
import { MIN_PASSWORD_LENGTH } from "@/lib/users/validation";

// POST /api/usuarios/:id/reset-password { password } -> o ADMIN define uma
// senha temporária nova (só ADMIN). O usuário troca depois em Meu perfil.
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: "Acesso restrito a administradores." }, { status: auth.status });

  const body = await request.json().catch(() => ({}));
  const password = typeof body.password === "string" ? body.password : "";
  if (password.length < MIN_PASSWORD_LENGTH) {
    return NextResponse.json({ error: `A senha temporária precisa ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.` }, { status: 400 });
  }
  const target = await db.user.findUnique({ where: { id: params.id }, select: { id: true } });
  if (!target) return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });

  await db.user.update({ where: { id: target.id }, data: { passwordHash: await hash(password, 10) } });
  return NextResponse.json({ ok: true });
}
