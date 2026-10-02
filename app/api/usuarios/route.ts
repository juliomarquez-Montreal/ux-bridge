import { NextResponse } from "next/server";
import type { Funcao, PermissionLevel, Prisma } from "@prisma/client";
import { hash } from "bcryptjs";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth-helpers";
import { FUNCOES, MIN_PASSWORD_LENGTH, PERMISSIONS, isValidEmail } from "@/lib/users/validation";

const PAGE_SIZE = 15;

// GET /api/usuarios?page=&q=&funcao=&permissao= -> lista paginada (só ADMIN).
export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: "Acesso restrito a administradores." }, { status: auth.status });

  const params = new URL(request.url).searchParams;
  const q = (params.get("q") ?? "").trim();
  const funcao = params.get("funcao") ?? "";
  const permissao = params.get("permissao") ?? "";
  const requestedPage = Math.max(1, parseInt(params.get("page") ?? "1", 10) || 1);

  const filters: Prisma.UserWhereInput[] = [];
  if (q) filters.push({ OR: [{ name: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }] });
  if ((FUNCOES as string[]).includes(funcao)) filters.push({ funcao: funcao as Funcao });
  if ((PERMISSIONS as string[]).includes(permissao)) filters.push({ permissionLevel: permissao as PermissionLevel });
  const where: Prisma.UserWhereInput = { AND: filters };

  const total = await db.user.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(requestedPage, totalPages);

  const users = await db.user.findMany({
    where,
    orderBy: [{ name: "asc" }, { id: "asc" }],
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    select: {
      id: true,
      name: true,
      email: true,
      funcao: true,
      permissionLevel: true,
      active: true,
      createdAt: true,
      galaxyAccess: { select: { galaxyId: true, galaxy: { select: { name: true } } } },
    },
  });

  return NextResponse.json({
    items: users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      funcao: u.funcao,
      permissionLevel: u.permissionLevel,
      active: u.active,
      createdAt: u.createdAt,
      galaxies: u.galaxyAccess.map((g) => ({ id: g.galaxyId, name: g.galaxy.name })),
    })),
    total,
    page,
    totalPages,
    pageSize: PAGE_SIZE,
  });
}

// POST /api/usuarios -> cria usuário (só ADMIN). Body: { name, email, password,
// funcao, permissionLevel, galaxyIds? }.
export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: "Acesso restrito a administradores." }, { status: auth.status });

  const body = await request.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const funcao = body.funcao as Funcao;
  const permissionLevel = body.permissionLevel as PermissionLevel;
  const galaxyIds: string[] = Array.isArray(body.galaxyIds) ? body.galaxyIds.filter((x: unknown): x is string => typeof x === "string") : [];

  if (!name) return NextResponse.json({ error: "Informe o nome." }, { status: 400 });
  if (!isValidEmail(email)) return NextResponse.json({ error: "Informe um e-mail válido." }, { status: 400 });
  if (password.length < MIN_PASSWORD_LENGTH) {
    return NextResponse.json({ error: `A senha inicial precisa ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.` }, { status: 400 });
  }
  if (!FUNCOES.includes(funcao)) return NextResponse.json({ error: "Função inválida." }, { status: 400 });
  if (!PERMISSIONS.includes(permissionLevel)) return NextResponse.json({ error: "Permissão inválida." }, { status: 400 });

  if (await db.user.findUnique({ where: { email }, select: { id: true } })) {
    return NextResponse.json({ error: "Já existe um usuário com este e-mail." }, { status: 409 });
  }

  // Só Galáxias de verdade. Administrador tem acesso a tudo, então não grava vínculos.
  const validGalaxies =
    permissionLevel === "ADMIN" || galaxyIds.length === 0
      ? []
      : await db.contextNode.findMany({ where: { id: { in: galaxyIds }, type: "GALAXIA" }, select: { id: true } });

  const user = await db.user.create({
    data: {
      name,
      email,
      passwordHash: await hash(password, 10),
      funcao,
      permissionLevel,
      galaxyAccess: { create: validGalaxies.map((g) => ({ galaxyId: g.id })) },
    },
    select: { id: true },
  });
  return NextResponse.json({ user }, { status: 201 });
}
