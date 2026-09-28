import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-helpers";

// PATCH /api/settings/current-galaxy -> atualiza a Galáxia selecionada no
// seletor do header ({ galaxyId }). Valida que o usuário tem acesso a essa
// Galáxia (via UserGalaxyAccess) antes de permitir — ADMIN pode escolher
// qualquer uma. A seleção persiste entre sessões (fica no banco, não na
// sessão/JWT).
export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const galaxyId = typeof body.galaxyId === "string" ? body.galaxyId : "";
  if (!galaxyId) return NextResponse.json({ error: "galaxyId é obrigatório." }, { status: 400 });

  const galaxy = await db.contextNode.findUnique({ where: { id: galaxyId } });
  if (!galaxy) return NextResponse.json({ error: "Galáxia não encontrada." }, { status: 404 });
  if (galaxy.type !== "GALAXIA") {
    return NextResponse.json({ error: "galaxyId precisa referenciar um nó do tipo Galáxia." }, { status: 400 });
  }

  if (user.permissionLevel !== "ADMIN") {
    const access = await db.userGalaxyAccess.findUnique({
      where: { userId_galaxyId: { userId: user.id, galaxyId } },
    });
    if (!access) {
      return NextResponse.json({ error: "Você não tem acesso a esta Galáxia." }, { status: 403 });
    }
  }

  try {
    await db.user.update({ where: { id: user.id }, data: { currentGalaxyId: galaxyId } });
  } catch (err) {
    // DIAGNÓSTICO TEMPORÁRIO (Fase N7): 500 opaco em produção neste update
    // específico — expõe a mensagem real pra investigar, remover depois.
    const e = err as { message?: string; code?: string; meta?: unknown };
    return NextResponse.json({ error: "DEBUG", message: e?.message, code: e?.code, meta: e?.meta }, { status: 500 });
  }

  return NextResponse.json({ ok: true, currentGalaxyId: galaxyId });
}
