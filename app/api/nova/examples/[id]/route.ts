import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-helpers";
import { canModifyNode } from "@/lib/nova/permissions";
import { extractStoragePath, getSupabaseAdmin, PLANET_EXAMPLES_BUCKET } from "@/lib/supabase-admin";

interface Params {
  params: { id: string };
}

// DELETE /api/nova/examples/:id -> remove um exemplo de treino (registro +
// arquivo no Storage, se houver). Mesma permissão de editar o Planeta dono
// do exemplo: ADMIN em qualquer lugar, ou dono dentro da própria Galáxia.
export async function DELETE(_request: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const example = await db.planetExample.findUnique({ where: { id: params.id } });
  if (!example) return NextResponse.json({ error: "Exemplo não encontrado." }, { status: 404 });

  const node = await db.contextNode.findUnique({ where: { id: example.contextNodeId } });
  if (!node) return NextResponse.json({ error: "Planeta dono deste exemplo não encontrado." }, { status: 404 });

  const permission = await canModifyNode({ nodeId: node.id, nodeType: node.type, user });
  if (!permission.allowed) {
    return NextResponse.json({ error: permission.reason }, { status: 403 });
  }

  if (example.fileUrl) {
    const path = extractStoragePath(example.fileUrl, PLANET_EXAMPLES_BUCKET);
    if (path) {
      const admin = getSupabaseAdmin();
      // Não bloqueia a exclusão do registro se o arquivo já não existir no
      // Storage por algum motivo — só loga, o registro é o que importa.
      const { error } = await admin.storage.from(PLANET_EXAMPLES_BUCKET).remove([path]);
      if (error) console.error("Falha ao remover arquivo do Storage:", error.message);
    }
  }

  await db.planetExample.delete({ where: { id: example.id } });
  return NextResponse.json({ ok: true });
}
