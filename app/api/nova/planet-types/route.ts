import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-helpers";

// GET: qualquer usuário autenticado pode listar (usado no seletor ao criar um Planeta).
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const planetTypes = await db.planetType.findMany({ orderBy: { name: "asc" } });
  return NextResponse.json({ planetTypes });
}

// POST: só ADMIN gerencia o catálogo global.
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  if (user.permissionLevel !== "ADMIN") {
    return NextResponse.json({ error: "Só administradores podem criar tipos de Planeta." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const description = typeof body.description === "string" ? body.description.trim() : null;

  if (!name) return NextResponse.json({ error: "name é obrigatório." }, { status: 400 });

  const existing = await db.planetType.findUnique({ where: { name } });
  if (existing) return NextResponse.json({ error: "Já existe um tipo de Planeta com esse nome." }, { status: 409 });

  const planetType = await db.planetType.create({ data: { name, description } });
  return NextResponse.json({ planetType }, { status: 201 });
}
