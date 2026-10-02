import { NextResponse } from "next/server";
import type { Funcao, PermissionLevel } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth-helpers";
import { FUNCOES, PERMISSIONS, isValidEmail } from "@/lib/users/validation";

// PATCH /api/usuarios/:id -> edita nome, e-mail, função, permissão, ativo e a
// lista de Galáxias com acesso (só ADMIN). Todos os campos são opcionais.
// Trava de segurança: o administrador não pode desativar nem rebaixar a si
// mesmo (evita ficar sem nenhum admin no sistema).
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: "Acesso restrito a administradores." }, { status: auth.status });

  const target = await db.user.findUnique({ where: { id: params.id } });
  if (!target) return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const data: { name?: string; email?: string; funcao?: Funcao; permissionLevel?: PermissionLevel; active?: boolean } = {};

  if (typeof body.name === "string") {
    if (!body.name.trim()) return NextResponse.json({ error: "O nome não pode ficar vazio." }, { status: 400 });
    data.name = body.name.trim();
  }
  if (typeof body.email === "string") {
    const email = body.email.trim().toLowerCase();
    if (!isValidEmail(email)) return NextResponse.json({ error: "Informe um e-mail válido." }, { status: 400 });
    if (email !== target.email) {
      if (await db.user.findUnique({ where: { email }, select: { id: true } })) {
        return NextResponse.json({ error: "Já existe um usuário com este e-mail." }, { status: 409 });
      }
      data.email = email;
    }
  }
  if (body.funcao !== undefined) {
    if (!FUNCOES.includes(body.funcao)) return NextResponse.json({ error: "Função inválida." }, { status: 400 });
    data.funcao = body.funcao;
  }
  if (body.permissionLevel !== undefined) {
    if (!PERMISSIONS.includes(body.permissionLevel)) return NextResponse.json({ error: "Permissão inválida." }, { status: 400 });
    data.permissionLevel = body.permissionLevel;
  }
  if (typeof body.active === "boolean") data.active = body.active;

  if (target.id === auth.user.id) {
    if (data.active === false) return NextResponse.json({ error: "Você não pode desativar a sua própria conta." }, { status: 400 });
    if (data.permissionLevel === "USER") {
      return NextResponse.json({ error: "Você não pode remover a sua própria permissão de administrador." }, { status: 400 });
    }
  }

  const finalPermission = data.permissionLevel ?? target.permissionLevel;
  let galaxyIds: string[] | null = null;
  if (Array.isArray(body.galaxyIds)) {
    const requested: string[] = body.galaxyIds.filter((x: unknown): x is string => typeof x === "string");
    galaxyIds =
      finalPermission === "ADMIN" || requested.length === 0
        ? []
        : (await db.contextNode.findMany({ where: { id: { in: requested }, type: "GALAXIA" }, select: { id: true } })).map((g) => g.id);
  }

  await db.$transaction([
    db.user.update({ where: { id: target.id }, data }),
    ...(galaxyIds !== null
      ? [
          db.userGalaxyAccess.deleteMany({ where: { userId: target.id } }),
          db.userGalaxyAccess.createMany({ data: galaxyIds.map((galaxyId) => ({ userId: target.id, galaxyId })) }),
        ]
      : []),
  ]);
  return NextResponse.json({ ok: true });
}
