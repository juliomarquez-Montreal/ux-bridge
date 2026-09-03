import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-helpers";
import { db } from "@/lib/db";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Troca de email: autosave, sem senha atual (decisão explícita de UX — ver
// conversa/commit). Ainda valida formato e unicidade. Sempre sobre o usuário
// da sessão, nunca um id vindo do cliente.
export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const newEmail = typeof body.newEmail === "string" ? body.newEmail.trim().toLowerCase() : "";

  if (!EMAIL_REGEX.test(newEmail)) {
    return NextResponse.json({ error: "Email em formato inválido." }, { status: 400 });
  }

  const dbUser = await db.user.findUnique({ where: { id: user.id } });
  if (!dbUser) return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });

  if (newEmail !== dbUser.email) {
    const existing = await db.user.findUnique({ where: { email: newEmail } });
    if (existing) {
      return NextResponse.json({ error: "Este email já está em uso." }, { status: 409 });
    }
  }

  const updated = await db.user.update({ where: { id: user.id }, data: { email: newEmail } });

  return NextResponse.json({ email: updated.email });
}
