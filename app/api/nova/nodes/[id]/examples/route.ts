import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-helpers";
import { canModifyNode } from "@/lib/nova/permissions";
import { ensurePlanetExamplesBucket, getSupabaseAdmin, PLANET_EXAMPLES_BUCKET } from "@/lib/supabase-admin";

interface Params {
  params: { id: string };
}

const VALID_KINDS = ["RAW_TRANSCRIPT", "FINAL_BDD_PBI", "WIREFRAME_REFERENCE"] as const;
type Kind = (typeof VALID_KINDS)[number];

const MAX_SIZE_BYTES: Record<Kind, number> = {
  RAW_TRANSCRIPT: 5 * 1024 * 1024,
  FINAL_BDD_PBI: 5 * 1024 * 1024,
  WIREFRAME_REFERENCE: 15 * 1024 * 1024,
};

// Arquivo aceito por kind — validado por extensão (o mime que o navegador
// manda pra .docx/.txt varia demais pra confiar só nele).
const ALLOWED_EXTENSIONS: Record<Kind, string[]> = {
  RAW_TRANSCRIPT: ["txt", "docx"],
  FINAL_BDD_PBI: ["txt", "docx"],
  WIREFRAME_REFERENCE: ["pdf", "png", "jpg", "jpeg"],
};

function extensionOf(filename: string): string {
  return filename.split(".").pop()?.toLowerCase() ?? "";
}

// GET /api/nova/nodes/:id/examples -> exemplos de treino anexados a este Planeta.
export async function GET(_request: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const examples = await db.planetExample.findMany({
    where: { contextNodeId: params.id },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ examples });
}

// POST /api/nova/nodes/:id/examples -> anexa um exemplo (arquivo ou texto colado).
// multipart/form-data: kind (obrigatório) + file OU textContent.
export async function POST(request: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const node = await db.contextNode.findUnique({ where: { id: params.id } });
  if (!node) return NextResponse.json({ error: "Nó não encontrado." }, { status: 404 });
  if (node.type !== "PLANETA") {
    return NextResponse.json({ error: "Exemplos de treino só podem ser anexados a um Planeta." }, { status: 400 });
  }

  const permission = await canModifyNode({ nodeId: node.id, nodeType: node.type, user });
  if (!permission.allowed) {
    return NextResponse.json({ error: permission.reason }, { status: 403 });
  }

  const formData = await request.formData().catch(() => null);
  if (!formData) return NextResponse.json({ error: "Formulário inválido." }, { status: 400 });

  const kind = formData.get("kind");
  if (typeof kind !== "string" || !VALID_KINDS.includes(kind as Kind)) {
    return NextResponse.json(
      { error: "kind inválido. Use: RAW_TRANSCRIPT | FINAL_BDD_PBI | WIREFRAME_REFERENCE." },
      { status: 400 }
    );
  }

  const file = formData.get("file");
  const rawText = formData.get("textContent");
  const textContent = typeof rawText === "string" ? rawText.trim() : "";
  const hasFile = file instanceof File && file.size > 0;
  const hasText = textContent.length > 0;

  if (kind === "WIREFRAME_REFERENCE" && !hasFile) {
    return NextResponse.json({ error: "Wireframe de referência exige um arquivo (PDF ou imagem)." }, { status: 400 });
  }
  if (!hasFile && !hasText) {
    return NextResponse.json({ error: "Envie um arquivo ou cole o texto do exemplo." }, { status: 400 });
  }
  if (hasFile && hasText) {
    return NextResponse.json({ error: "Envie um arquivo OU cole texto, não os dois." }, { status: 400 });
  }

  let fileUrl: string | null = null;

  if (hasFile && file instanceof File) {
    const extension = extensionOf(file.name);
    if (!ALLOWED_EXTENSIONS[kind as Kind].includes(extension)) {
      return NextResponse.json(
        { error: `Extensão .${extension || "?"} não permitida para este tipo. Use: ${ALLOWED_EXTENSIONS[kind as Kind].map((e) => `.${e}`).join(", ")}.` },
        { status: 400 }
      );
    }
    if (file.size > MAX_SIZE_BYTES[kind as Kind]) {
      return NextResponse.json(
        { error: `Arquivo muito grande (máx. ${Math.round(MAX_SIZE_BYTES[kind as Kind] / (1024 * 1024))}MB).` },
        { status: 400 }
      );
    }

    try {
      await ensurePlanetExamplesBucket();
      const admin = getSupabaseAdmin();
      // Mantém o nome original (saneado) no path em vez de um UUID puro, pra
      // a lista de exemplos poder mostrar um nome de arquivo legível.
      const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_").slice(-80);
      const path = `${node.id}/${kind}/${Date.now()}-${safeName}`;
      const buffer = Buffer.from(await file.arrayBuffer());

      const { error: uploadError } = await admin.storage
        .from(PLANET_EXAMPLES_BUCKET)
        .upload(path, buffer, { contentType: file.type || undefined, upsert: false });
      if (uploadError) throw uploadError;

      const { data: publicUrlData } = admin.storage.from(PLANET_EXAMPLES_BUCKET).getPublicUrl(path);
      fileUrl = publicUrlData.publicUrl;
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Falha ao enviar o arquivo." },
        { status: 500 }
      );
    }
  }

  const example = await db.planetExample.create({
    data: {
      contextNodeId: node.id,
      kind,
      fileUrl,
      textContent: hasText ? textContent : null,
      uploadedById: user.id,
    },
  });

  return NextResponse.json({ example }, { status: 201 });
}
