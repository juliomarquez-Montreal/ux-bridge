import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-helpers";

interface Params {
  params: { id: string };
}

// PATCH/DELETE: só ADMIN gerencia o catálogo global de tipos de Planeta.
export async function PATCH(request: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  if (user.permissionLevel !== "ADMIN") {
    return NextResponse.json({ error: "Só administradores podem editar tipos de Planeta." }, { status: 403 });
  }

  const planetType = await db.planetType.findUnique({ where: { id: params.id } });
  if (!planetType) return NextResponse.json({ error: "Tipo de Planeta não encontrado." }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const data: { name?: string; description?: string | null } = {};

  if (typeof body.name === "string") {
    const name = body.name.trim();
    if (!name) return NextResponse.json({ error: "name não pode ficar vazio." }, { status: 400 });
    data.name = name;
  }
  if (typeof body.description === "string" || body.description === null) {
    data.description = body.description;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nada para atualizar." }, { status: 400 });
  }

  const updated = await db.planetType.update({ where: { id: planetType.id }, data });
  return NextResponse.json({ planetType: updated });
}

export async function DELETE(_request: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  if (user.permissionLevel !== "ADMIN") {
    return NextResponse.json({ error: "Só administradores podem excluir tipos de Planeta." }, { status: 403 });
  }

  const planetType = await db.planetType.findUnique({ where: { id: params.id } });
  if (!planetType) return NextResponse.json({ error: "Tipo de Planeta não encontrado." }, { status: 404 });

  const usageCount = await db.contextNode.count({ where: { planetTypeId: planetType.id } });
  if (usageCount > 0) {
    return NextResponse.json(
      { error: `Este tipo de Planeta está em uso por ${usageCount} nó(s) e não pode ser excluído.` },
      { status: 409 }
    );
  }

  await db.planetType.delete({ where: { id: planetType.id } });
  return NextResponse.json({ ok: true });
}
