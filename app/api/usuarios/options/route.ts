import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth-helpers";

// GET /api/usuarios/options -> Galáxias disponíveis pro seletor de acesso.
export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: "Acesso restrito a administradores." }, { status: auth.status });
  const galaxies = await db.contextNode.findMany({ where: { type: "GALAXIA" }, orderBy: { name: "asc" }, select: { id: true, name: true } });
  return NextResponse.json({ galaxies });
}
