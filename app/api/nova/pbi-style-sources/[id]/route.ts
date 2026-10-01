import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-helpers";
import { canManageGalaxy } from "@/lib/nova/permissions";
import { extractStoragePath, getSupabaseAdmin, PBI_STYLE_SOURCES_BUCKET } from "@/lib/supabase-admin";

interface Params {
  params: { id: string };
}

// DELETE /api/nova/pbi-style-sources/:id -> remove um PBI de exemplo (banco
// + arquivo original no Storage). Mesma permissão de gerenciar recursos da
// Galáxia (ADMIN em qualquer uma, usuário comum só na própria).
export async function DELETE(_request: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const source = await db.pbiStyleSource.findUnique({ where: { id: params.id } });
  if (!source) return NextResponse.json({ error: "PBI de exemplo não encontrado." }, { status: 404 });

  const permission = await canManageGalaxy({ galaxyId: source.galaxyId, user });
  if (!permission.allowed) {
    return NextResponse.json({ error: permission.reason }, { status: 403 });
  }

  const path = extractStoragePath(source.fileUrl, PBI_STYLE_SOURCES_BUCKET);
  if (path) {
    const admin = getSupabaseAdmin();
    await admin.storage.from(PBI_STYLE_SOURCES_BUCKET).remove([path]).catch(() => {});
  }

  await db.pbiStyleSource.delete({ where: { id: params.id } });

  return NextResponse.json({ ok: true });
}
