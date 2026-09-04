import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, requireAdmin } from "@/lib/auth-helpers";
import { FigmaApiError } from "@/lib/figma/client";
import { FigmaUrlError, parseFigmaFileKey } from "@/lib/figma/parseUrl";
import { syncDesignSystemSource } from "@/lib/figma/sync";

// A rota POST já sincroniza ao criar (busca no Figma + upsert em lote), então
// pode levar alguns segundos num arquivo grande.
export const maxDuration = 30;

const INCLUDE = {
  components: { orderBy: { name: "asc" as const } },
  galaxyLinks: { include: { galaxy: { select: { id: true, name: true } } } },
} satisfies Prisma.DesignSystemSourceInclude;

type SourceWithRelations = Prisma.DesignSystemSourceGetPayload<{ include: typeof INCLUDE }>;

function serializeSource(source: SourceWithRelations) {
  return {
    id: source.id,
    name: source.name,
    figmaFileKey: source.figmaFileKey,
    figmaUrl: source.figmaUrl,
    lastSyncedAt: source.lastSyncedAt,
    addedById: source.addedById,
    createdAt: source.createdAt,
    components: source.components,
    galaxyLinks: source.galaxyLinks.map((link) => ({ galaxyId: link.galaxyId, galaxyName: link.galaxy.name })),
  };
}

// GET /api/nova/design-system/sources -> catálogo global de Design Systems
// (qualquer usuário autenticado pode ver; só ADMIN gerencia via os outros
// verbos). Cada fonte já vem com os componentes e as Galáxias vinculadas.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const sources = await db.designSystemSource.findMany({ orderBy: { name: "asc" }, include: INCLUDE });
  return NextResponse.json({ sources: sources.map(serializeSource) });
}

// POST /api/nova/design-system/sources -> cria uma fonte (ADMIN-only, catálogo
// global) e já sincroniza automaticamente. Não recebe Galáxia aqui — o
// vínculo com Galáxia(s) é feito depois, via .../sources/:id/galaxies.
export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (!admin.ok) {
    return NextResponse.json(
      { error: admin.status === 401 ? "Não autorizado." : "Só administradores podem criar Design Systems." },
      { status: admin.status }
    );
  }

  const body = await request.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const figmaUrl = typeof body.figmaUrl === "string" ? body.figmaUrl.trim() : "";

  if (!name) return NextResponse.json({ error: "name é obrigatório." }, { status: 400 });
  if (!figmaUrl) return NextResponse.json({ error: "figmaUrl é obrigatório." }, { status: 400 });

  let figmaFileKey: string;
  try {
    figmaFileKey = parseFigmaFileKey(figmaUrl);
  } catch (error) {
    const message = error instanceof FigmaUrlError ? error.message : "Link do Figma inválido.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const created = await db.designSystemSource.create({
    data: { name, figmaUrl, figmaFileKey, addedById: admin.user.id },
  });

  let sync = null;
  let syncError: string | null = null;
  try {
    sync = await syncDesignSystemSource(created);
  } catch (error) {
    syncError =
      error instanceof FigmaApiError ? error.message : "Falha inesperada ao sincronizar com o Figma agora.";
  }

  const fresh = await db.designSystemSource.findUniqueOrThrow({ where: { id: created.id }, include: INCLUDE });

  return NextResponse.json({ source: serializeSource(fresh), sync, syncError }, { status: 201 });
}
