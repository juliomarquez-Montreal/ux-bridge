import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-helpers";

// Sugestões pré-definidas sempre disponíveis, mesmo que ainda não tenham
// sido usadas por nenhum exemplo.
const SEED_TYPES = ["Wireframe simples", "Protótipo de alta-fidelidade"];

// GET /api/nova/examples/reference-types -> valores distintos já usados em
// PlanetExample.referenceType (kind=WIREFRAME_REFERENCE) em todo o sistema,
// combinados com as sugestões pré-definidas. Sem tabela de catálogo própria
// — qualquer usuário logado pode ver, e criar um valor novo é só digitá-lo
// na hora de anexar um wireframe (vira sugestão pros próximos uploads).
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const rows = await db.planetExample.findMany({
    where: { kind: "WIREFRAME_REFERENCE", referenceType: { not: null } },
    select: { referenceType: true },
    distinct: ["referenceType"],
  });

  const used = rows.map((r) => r.referenceType).filter((v): v is string => Boolean(v));
  const referenceTypes = Array.from(new Set([...SEED_TYPES, ...used])).sort((a, b) => a.localeCompare(b, "pt-BR"));

  return NextResponse.json({ referenceTypes });
}
