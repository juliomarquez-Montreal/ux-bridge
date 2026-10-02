import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-helpers";
import { canAccessBridgeForPlanet } from "@/lib/nova/permissions";
import { ensureBridgeMaterialsBucket, getSupabaseAdmin, BRIDGE_MATERIALS_BUCKET } from "@/lib/supabase-admin";
import { runBddGeneration } from "@/lib/bridges/generate";
import { BRIDGE_WITH_PLANET_INCLUDE } from "@/lib/bridges/include";
import { logActivity } from "@/lib/activity/logActivity";

// A geração roda dentro da própria requisição (sem fila) — pode levar
// bastante tempo numa chamada de IA real, então damos mais margem que o
// default de 10s do runtime Node na Vercel (o valor efetivo ainda depende do
// plano/projeto, mas declarar isso aqui é o que o Next.js espera).
export const maxDuration = 60;

const ALLOWED_EXTENSIONS = ["txt", "docx"];
const MAX_SIZE_BYTES = 5 * 1024 * 1024;

function extensionOf(filename: string): string {
  return filename.split(".").pop()?.toLowerCase() ?? "";
}

async function uploadMaterialFile(bridgeId: string, file: File): Promise<string> {
  await ensureBridgeMaterialsBucket();
  const admin = getSupabaseAdmin();
  const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_").slice(-80);
  const path = `${bridgeId}/${Date.now()}-${safeName}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error } = await admin.storage
    .from(BRIDGE_MATERIALS_BUCKET)
    .upload(path, buffer, { contentType: file.type || undefined, upsert: false });
  if (error) throw error;

  const { data } = admin.storage.from(BRIDGE_MATERIALS_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

// GET /api/bridges -> lista os Bridges do usuário logado (ADMIN vê todos),
// com Planeta/Estrela/Galáxia já resolvidos pra tabela de /bridges.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const bridges = await db.bridge.findMany({
    where: user.permissionLevel === "ADMIN" ? {} : { createdById: user.id },
    orderBy: { createdAt: "desc" },
    include: {
      planet: {
        select: {
          id: true,
          name: true,
          parent: { select: { id: true, name: true, parent: { select: { id: true, name: true } } } },
        },
      },
      projectLink: { select: { project: { select: { id: true, name: true } } } },
    },
  });

  // Bridge.createdById não tem relação formal com User no schema (só o
  // scalar id) — resolve os nomes num segundo select em vez de duplicar a
  // FK, já que é só pra exibição na coluna "Criado por".
  const creatorIds = Array.from(new Set(bridges.map((bridge) => bridge.createdById)));
  const creators = await db.user.findMany({ where: { id: { in: creatorIds } }, select: { id: true, name: true } });
  const creatorNameById = new Map(creators.map((creator) => [creator.id, creator.name]));

  const result = bridges.map((bridge) => ({
    id: bridge.id,
    status: bridge.status,
    createdAt: bridge.createdAt,
    attemptCount: bridge.attemptCount,
    bddApprovedAt: bridge.bddApprovedAt,
    createdBy: creatorNameById.get(bridge.createdById) ?? "—",
    planeta: { id: bridge.planet.id, name: bridge.planet.name },
    estrela: bridge.planet.parent ? { id: bridge.planet.parent.id, name: bridge.planet.parent.name } : null,
    galaxia: bridge.planet.parent?.parent
      ? { id: bridge.planet.parent.parent.id, name: bridge.planet.parent.parent.name }
      : null,
    project: bridge.projectLink ? { id: bridge.projectLink.project.id, name: bridge.projectLink.project.name } : null,
  }));

  return NextResponse.json({ bridges: result });
}

// POST /api/bridges -> cria um Bridge (multipart/form-data: planetContextNodeId
// + file OU textContent) e dispara a geração do BDD/PBI antes de responder.
// O registro é criado (status GERANDO_BDD) ANTES da chamada à IA — fechar a
// aba no meio não perde o Bridge, só atrasa quando o resultado aparece.
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const formData = await request.formData().catch(() => null);
  if (!formData) return NextResponse.json({ error: "Formulário inválido." }, { status: 400 });

  const planetContextNodeId = formData.get("planetContextNodeId");
  if (typeof planetContextNodeId !== "string" || !planetContextNodeId) {
    return NextResponse.json({ error: "planetContextNodeId é obrigatório." }, { status: 400 });
  }

  const planet = await db.contextNode.findUnique({ where: { id: planetContextNodeId } });
  if (!planet) return NextResponse.json({ error: "Planeta não encontrado." }, { status: 404 });
  if (planet.type !== "PLANETA") {
    return NextResponse.json({ error: "Bridges só podem ser criados a partir de um Planeta." }, { status: 400 });
  }

  const permission = await canAccessBridgeForPlanet({ planetId: planet.id, user });
  if (!permission.allowed) return NextResponse.json({ error: permission.reason }, { status: 403 });

  const file = formData.get("file");
  const rawText = formData.get("textContent");
  const textContent = typeof rawText === "string" ? rawText.trim() : "";
  const hasFile = file instanceof File && file.size > 0;
  const hasText = textContent.length > 0;

  if (!hasFile && !hasText) {
    return NextResponse.json({ error: "Envie um arquivo ou cole o texto do material." }, { status: 400 });
  }
  if (hasFile && hasText) {
    return NextResponse.json({ error: "Envie um arquivo OU cole texto, não os dois." }, { status: 400 });
  }
  if (hasFile && file instanceof File) {
    const extension = extensionOf(file.name);
    if (!ALLOWED_EXTENSIONS.includes(extension)) {
      return NextResponse.json({ error: `Extensão .${extension || "?"} não permitida. Use: .txt, .docx.` }, { status: 400 });
    }
    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json({ error: "Arquivo muito grande (máx. 5MB)." }, { status: 400 });
    }
  }

  const bridge = await db.bridge.create({
    data: { planetContextNodeId: planet.id, createdById: user.id, poUserId: user.id, status: "GERANDO_BDD" },
  });
  await logActivity({
    userId: user.id,
    action: "BRIDGE_CREATED",
    entityType: "BRIDGE",
    entityId: bridge.id,
    entityLabel: planet.name,
    galaxyFromNodeId: planet.id,
  });

  if (hasFile && file instanceof File) {
    try {
      const rawMaterialFileUrl = await uploadMaterialFile(bridge.id, file);
      await db.bridge.update({ where: { id: bridge.id }, data: { rawMaterialFileUrl } });
    } catch (error) {
      const updated = await db.bridge.update({
        where: { id: bridge.id },
        data: {
          status: "ERRO_GERACAO",
          errorMessage: error instanceof Error ? error.message : "Falha ao enviar o arquivo.",
        },
      });
      return NextResponse.json({ bridge: updated }, { status: 201 });
    }
  } else {
    await db.bridge.update({ where: { id: bridge.id }, data: { rawMaterialText: textContent } });
  }

  await runBddGeneration(bridge.id);

  const finalBridge = await db.bridge.findUnique({ where: { id: bridge.id }, include: BRIDGE_WITH_PLANET_INCLUDE });
  return NextResponse.json({ bridge: finalBridge }, { status: 201 });
}
