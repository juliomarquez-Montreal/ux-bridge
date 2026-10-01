import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-helpers";
import { canManageGalaxy } from "@/lib/nova/permissions";
import { ensurePbiStyleSourcesBucket, getSupabaseAdmin, PBI_STYLE_SOURCES_BUCKET } from "@/lib/supabase-admin";
import { ALLOWED_PBI_STYLE_EXTENSIONS, extractFileText, pbiStyleExtensionOf } from "@/lib/pbiStyle/extractFileText";
import { extractAcceptanceCriteria } from "@/lib/pbiStyle/extractAcceptanceCriteria";

const MAX_SIZE_BYTES = 10 * 1024 * 1024;

// GET /api/nova/pbi-style-sources?galaxyId=... -> PBIs de exemplo já
// enviados pra essa Galáxia, mais recente primeiro. Só exige autenticação
// (mesmo padrão de leitura das outras rotas da NOVA — ver
// app/api/nova/nodes/[id]/examples/route.ts).
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const galaxyId = new URL(request.url).searchParams.get("galaxyId");
  if (!galaxyId) return NextResponse.json({ error: "galaxyId é obrigatório." }, { status: 400 });

  const sources = await db.pbiStyleSource.findMany({
    where: { galaxyId },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ sources });
}

async function uploadPbiStyleFile(galaxyId: string, file: File): Promise<string> {
  await ensurePbiStyleSourcesBucket();
  const admin = getSupabaseAdmin();
  const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_").slice(-80);
  const path = `${galaxyId}/${Date.now()}-${safeName}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await admin.storage
    .from(PBI_STYLE_SOURCES_BUCKET)
    .upload(path, buffer, { contentType: file.type || undefined, upsert: false });
  if (uploadError) throw uploadError;

  const { data: publicUrlData } = admin.storage.from(PBI_STYLE_SOURCES_BUCKET).getPublicUrl(path);
  return publicUrlData.publicUrl;
}

// POST /api/nova/pbi-style-sources -> envia um ou mais PBIs de exemplo
// (multipart/form-data: `galaxyId` + `files`, repetido por arquivo). Pra
// cada arquivo: extrai o texto bruto (PDF/DOCX/MD), pede pra IA isolar só o
// bloco de Acceptance Criteria em Gherkin (descartando todo o ruído do
// documento real — ID, story points, commits etc.) e salva o resultado.
// Processa em sequência e nunca falha a request inteira por causa de UM
// arquivo com problema — cada resultado (sucesso ou erro) vem no array de
// resposta, indexado pelo nome do arquivo original.
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const formData = await request.formData().catch(() => null);
  if (!formData) return NextResponse.json({ error: "Formulário inválido." }, { status: 400 });

  const galaxyId = formData.get("galaxyId");
  if (typeof galaxyId !== "string" || !galaxyId) {
    return NextResponse.json({ error: "galaxyId é obrigatório." }, { status: 400 });
  }

  const galaxy = await db.contextNode.findUnique({ where: { id: galaxyId } });
  if (!galaxy) return NextResponse.json({ error: "Galáxia não encontrada." }, { status: 404 });
  if (galaxy.type !== "GALAXIA") {
    return NextResponse.json({ error: "galaxyId precisa referenciar um nó do tipo Galáxia." }, { status: 400 });
  }

  const permission = await canManageGalaxy({ galaxyId, user });
  if (!permission.allowed) {
    return NextResponse.json({ error: permission.reason }, { status: 403 });
  }

  const files = formData.getAll("files").filter((item): item is File => item instanceof File && item.size > 0);
  if (files.length === 0) {
    return NextResponse.json({ error: "Envie ao menos um arquivo (.pdf, .docx ou .md)." }, { status: 400 });
  }

  const results: Array<{ fileName: string; source?: unknown; error?: string }> = [];

  for (const file of files) {
    const extension = pbiStyleExtensionOf(file.name);
    if (!ALLOWED_PBI_STYLE_EXTENSIONS.includes(extension as (typeof ALLOWED_PBI_STYLE_EXTENSIONS)[number])) {
      results.push({ fileName: file.name, error: `Extensão .${extension || "?"} não permitida. Use: .pdf, .docx, .md.` });
      continue;
    }
    if (file.size > MAX_SIZE_BYTES) {
      results.push({ fileName: file.name, error: "Arquivo muito grande (máx. 10MB)." });
      continue;
    }

    try {
      const rawText = await extractFileText(file);
      if (!rawText.trim()) {
        results.push({ fileName: file.name, error: "Não foi possível extrair texto deste arquivo." });
        continue;
      }

      const extractedAcceptanceCriteria = await extractAcceptanceCriteria(rawText);
      const fileUrl = await uploadPbiStyleFile(galaxyId, file);

      const source = await db.pbiStyleSource.create({
        data: {
          galaxyId,
          fileName: file.name,
          fileUrl,
          extractedAcceptanceCriteria,
          uploadedById: user.id,
        },
      });

      results.push({ fileName: file.name, source });
    } catch (error) {
      results.push({ fileName: file.name, error: error instanceof Error ? error.message : "Falha ao processar o arquivo." });
    }
  }

  return NextResponse.json({ results }, { status: 201 });
}
