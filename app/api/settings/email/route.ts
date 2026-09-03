import { NextResponse } from "next/server";
import { compare } from "bcryptjs";
import { getCurrentUser } from "@/lib/auth-helpers";
import { db } from "@/lib/db";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Troca de email: exige a senha atual como trava básica (o projeto ainda não
// tem verificação por link de email), sempre sobre o usuário da sessão.
export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const newEmail = typeof body.newEmail === "string" ? body.newEmail.trim().toLowerCase() : "";
  const currentPassword = typeof body.currentPassword === "string" ? body.currentPassword : "";

  if (!EMAIL_REGEX.test(newEmail)) {
    return NextResponse.json({ error: "Email em formato inválido." }, { status: 400 });
  }
  if (!currentPassword) {
    return NextResponse.json({ error: "Informe sua senha atual." }, { status: 400 });
  }

  const dbUser = await db.user.findUnique({ where: { id: user.id } });
  if (!dbUser?.passwordHash) {
    return NextResponse.json({ error: "Usuário sem senha configurada." }, { status: 400 });
  }

  const valid = await compare(currentPassword, dbUser.passwordHash);
  if (!valid) {
    return NextResponse.json({ error: "Senha atual incorreta." }, { status: 401 });
  }

  if (newEmail !== dbUser.email) {
    const existing = await db.user.findUnique({ where: { email: newEmail } });
    if (existing) {
      return NextResponse.json({ error: "Este email já está em uso." }, { status: 409 });
    }
  }

  const updated = await db.user.update({ where: { id: user.id }, data: { email: newEmail } });

  return NextResponse.json({ email: updated.email });
}
