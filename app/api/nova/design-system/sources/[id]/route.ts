import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth-helpers";

interface Params {
  params: { id: string };
}

// DELETE /api/nova/design-system/sources/:id -> remove a fonte, seus
// componentes e vínculos com Galáxias (onDelete: Cascade no schema).
// Catálogo global gerenciado por ADMIN.
export async function DELETE(_request: Request, { params }: Params) {
  const admin = await requireAdmin();
  if (!admin.ok) {
    return NextResponse.json(
      { error: admin.status === 401 ? "Não autorizado." : "Só administradores podem remover Design Systems." },
      { status: admin.status }
    );
  }

  const source = await db.designSystemSource.findUnique({ where: { id: params.id } });
  if (!source) return NextResponse.json({ error: "Fonte não encontrada." }, { status: 404 });

  await db.designSystemSource.delete({ where: { id: source.id } });
  return NextResponse.json({ ok: true });
}
