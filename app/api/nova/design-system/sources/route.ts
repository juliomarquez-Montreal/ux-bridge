import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-helpers";
import { canManageGalaxy } from "@/lib/nova/permissions";
import { FigmaUrlError, parseFigmaFileKey } from "@/lib/figma/parseUrl";

// GET /api/nova/design-system/sources?galaxyId=x -> fontes de UMA Galáxia
// (qualquer usuário logado). Sem galaxyId, só ADMIN pode listar todas.
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const galaxyId = new URL(request.url).searchParams.get("galaxyId");

  if (!galaxyId) {
    if (user.permissionLevel !== "ADMIN") {
      return NextResponse.json(
        { error: "Informe galaxyId, ou seja administrador para listar todas as fontes." },
        { status: 403 }
      );
    }
    const sources = await db.designSystemSource.findMany({
      orderBy: { name: "asc" },
      include: { components: { orderBy: { name: "asc" } } },
    });
    return NextResponse.json({ sources });
  }

  const sources = await db.designSystemSource.findMany({
    where: { galaxyId },
    orderBy: { name: "asc" },
    include: { components: { orderBy: { name: "asc" } } },
  });
  return NextResponse.json({ sources });
}

// POST /api/nova/design-system/sources -> cria uma fonte vinculada a uma
// Galáxia (name + figmaUrl + galaxyId). Mesma permissão de criar
// Estrela/Planeta naquela Galáxia.
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const figmaUrl = typeof body.figmaUrl === "string" ? body.figmaUrl.trim() : "";
  const galaxyId = typeof body.galaxyId === "string" ? body.galaxyId : "";

  if (!name) return NextResponse.json({ error: "name é obrigatório." }, { status: 400 });
  if (!figmaUrl) return NextResponse.json({ error: "figmaUrl é obrigatório." }, { status: 400 });
  if (!galaxyId) return NextResponse.json({ error: "galaxyId é obrigatório." }, { status: 400 });

  const galaxy = await db.contextNode.findUnique({ where: { id: galaxyId } });
  if (!galaxy) return NextResponse.json({ error: "Galáxia não encontrada." }, { status: 404 });
  if (galaxy.type !== "GALAXIA") {
    return NextResponse.json({ error: "galaxyId precisa referenciar um nó do tipo Galáxia." }, { status: 400 });
  }

  const permission = await canManageGalaxy({ galaxyId, user });
  if (!permission.allowed) {
    return NextResponse.json({ error: permission.reason }, { status: 403 });
  }

  let figmaFileKey: string;
  try {
    figmaFileKey = parseFigmaFileKey(figmaUrl);
  } catch (error) {
    const message = error instanceof FigmaUrlError ? error.message : "Link do Figma inválido.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const source = await db.designSystemSource.create({
    data: { name, figmaUrl, figmaFileKey, galaxyId, addedById: user.id },
  });

  return NextResponse.json({ source: { ...source, components: [] } }, { status: 201 });
}
