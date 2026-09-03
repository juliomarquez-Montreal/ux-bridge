import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { AVATAR_BUCKET, ensureAvatarBucket, getSupabaseAdmin } from "@/lib/supabase-admin";

const MAX_SIZE_BYTES = 5 * 1024 * 1024;

// Recebe a imagem já recortada (client-side, via react-easy-crop) e sobe pro
// Supabase Storage. Sempre grava no id do usuário da sessão.
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Nenhum arquivo de imagem enviado." }, { status: 400 });
  }
  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "O arquivo precisa ser uma imagem." }, { status: 400 });
  }
  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: "Imagem muito grande (máx. 5MB)." }, { status: 400 });
  }

  try {
    await ensureAvatarBucket();
    const admin = getSupabaseAdmin();

    const extension = file.type.split("/")[1] ?? "jpg";
    const path = `${user.id}/${Date.now()}.${extension}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await admin.storage
      .from(AVATAR_BUCKET)
      .upload(path, buffer, { contentType: file.type, upsert: true });
    if (uploadError) throw uploadError;

    const { data: publicUrlData } = admin.storage.from(AVATAR_BUCKET).getPublicUrl(path);
    const avatarUrl = publicUrlData.publicUrl;

    await db.user.update({ where: { id: user.id }, data: { avatarUrl } });

    return NextResponse.json({ avatarUrl });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Falha ao enviar a imagem." },
      { status: 500 }
    );
  }
}
