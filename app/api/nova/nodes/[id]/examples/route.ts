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

// Sobe um arquivo pro bucket de exemplos e devolve a URL pública. `slot` é só
// um sufixo de organização no path (ex: "initial"/"final" pro par de BDD/PBI).
async function uploadExampleFile(nodeId: string, kind: Kind, slot: string, file: File): Promise<string> {
  await ensurePlanetExamplesBucket();
  const admin = getSupabaseAdmin();
  const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_").slice(-80);
  const path = `${nodeId}/${kind}/${slot}/${Date.now()}-${safeName}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await admin.storage
    .from(PLANET_EXAMPLES_BUCKET)
    .upload(path, buffer, { contentType: file.type || undefined, upsert: false });
  if (uploadError) throw uploadError;

  const { data: publicUrlData } = admin.storage.from(PLANET_EXAMPLES_BUCKET).getPublicUrl(path);
  return publicUrlData.publicUrl;
}

function validateFile(file: File, kind: Kind): string | null {
  const extension = extensionOf(file.name);
  if (!ALLOWED_EXTENSIONS[kind].includes(extension)) {
    return `Extensão .${extension || "?"} não permitida para este tipo. Use: ${ALLOWED_EXTENSIONS[kind].map((e) => `.${e}`).join(", ")}.`;
  }
  if (file.size > MAX_SIZE_BYTES[kind]) {
    return `Arquivo muito grande (máx. ${Math.round(MAX_SIZE_BYTES[kind] / (1024 * 1024))}MB).`;
  }
  return null;
}

// POST /api/nova/nodes/:id/examples -> anexa um exemplo. multipart/form-data,
// sempre com `kind`; o resto depende do kind:
//   RAW_TRANSCRIPT: file OU textContent (um dos dois, obrigatório).
//   FINAL_BDD_PBI: par inicial/final — initialFile/initialTextContent e
//     finalFile/finalTextContent, cada lado independentemente opcional
//     (arquivo OU texto naquele lado), mas ao menos um dos dois lados
//     precisa vir preenchido.
//   WIREFRAME_REFERENCE: file obrigatório + referenceType opcional (texto
//     livre, sem tabela de catálogo — sugestões vêm de valores já usados).
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
  const typedKind = kind as Kind;

  try {
    if (typedKind === "FINAL_BDD_PBI") {
      const initialFile = formData.get("initialFile");
      const finalFile = formData.get("finalFile");
      const initialText = (formData.get("initialTextContent") as string | null)?.trim() ?? "";
      const finalText = (formData.get("finalTextContent") as string | null)?.trim() ?? "";

      const hasInitialFile = initialFile instanceof File && initialFile.size > 0;
      const hasInitialText = initialText.length > 0;
      const hasFinalFile = finalFile instanceof File && finalFile.size > 0;
      const hasFinalText = finalText.length > 0;

      if (hasInitialFile && hasInitialText) {
        return NextResponse.json({ error: "Versão inicial: envie um arquivo OU cole texto, não os dois." }, { status: 400 });
      }
      if (hasFinalFile && hasFinalText) {
        return NextResponse.json({ error: "Versão final: envie um arquivo OU cole texto, não os dois." }, { status: 400 });
      }
      if (!hasInitialFile && !hasInitialText && !hasFinalFile && !hasFinalText) {
        return NextResponse.json(
          { error: "Preencha ao menos a versão inicial ou a versão final (arquivo ou texto)." },
          { status: 400 }
        );
      }

      let initialFileUrl: string | null = null;
      let finalFileUrl: string | null = null;

      if (hasInitialFile && initialFile instanceof File) {
        const validationError = validateFile(initialFile, typedKind);
        if (validationError) return NextResponse.json({ error: `Versão inicial: ${validationError}` }, { status: 400 });
        initialFileUrl = await uploadExampleFile(node.id, typedKind, "initial", initialFile);
      }
      if (hasFinalFile && finalFile instanceof File) {
        const validationError = validateFile(finalFile, typedKind);
        if (validationError) return NextResponse.json({ error: `Versão final: ${validationError}` }, { status: 400 });
        finalFileUrl = await uploadExampleFile(node.id, typedKind, "final", finalFile);
      }

      const example = await db.planetExample.create({
        data: {
          contextNodeId: node.id,
          kind: typedKind,
          initialTextContent: hasInitialText ? initialText : null,
          initialFileUrl,
          finalTextContent: hasFinalText ? finalText : null,
          finalFileUrl,
          uploadedById: user.id,
        },
      });

      return NextResponse.json({ example }, { status: 201 });
    }

    // RAW_TRANSCRIPT e WIREFRAME_REFERENCE: um único file OU textContent.
    const file = formData.get("file");
    const rawText = formData.get("textContent");
    const textContent = typeof rawText === "string" ? rawText.trim() : "";
    const hasFile = file instanceof File && file.size > 0;
    const hasText = textContent.length > 0;

    if (typedKind === "WIREFRAME_REFERENCE" && !hasFile) {
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
      const validationError = validateFile(file, typedKind);
      if (validationError) return NextResponse.json({ error: validationError }, { status: 400 });
      fileUrl = await uploadExampleFile(node.id, typedKind, "file", file);
    }

    let referenceType: string | null = null;
    if (typedKind === "WIREFRAME_REFERENCE") {
      const rawReferenceType = formData.get("referenceType");
      referenceType = typeof rawReferenceType === "string" && rawReferenceType.trim() ? rawReferenceType.trim() : null;
    }

    const example = await db.planetExample.create({
      data: {
        contextNodeId: node.id,
        kind: typedKind,
        fileUrl,
        textContent: hasText ? textContent : null,
        referenceType,
        uploadedById: user.id,
      },
    });

    return NextResponse.json({ example }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Falha ao enviar o arquivo." },
      { status: 500 }
    );
  }
}
