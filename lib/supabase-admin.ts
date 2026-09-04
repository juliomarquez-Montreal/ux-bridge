import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const AVATAR_BUCKET = "avatars";
export const PLANET_EXAMPLES_BUCKET = "planet-examples";

let cached: SupabaseClient | null = null;

// Cliente admin (service role) — só pode ser usado no servidor. Nunca importe
// isso em código de cliente: essa chave ignora RLS e tem acesso total.
export function getSupabaseAdmin(): SupabaseClient {
  if (cached) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY (ou NEXT_PUBLIC_SUPABASE_URL) não configurada no .env."
    );
  }

  cached = createClient(url, serviceKey, { auth: { persistSession: false } });
  return cached;
}

async function ensureBucket(name: string, fileSizeLimit: string): Promise<void> {
  const admin = getSupabaseAdmin();
  const { data: buckets, error } = await admin.storage.listBuckets();
  if (error) throw error;

  if (!buckets?.some((bucket) => bucket.name === name)) {
    const { error: createError } = await admin.storage.createBucket(name, { public: true, fileSizeLimit });
    // Ignora corrida entre duas requisições tentando criar o bucket ao mesmo tempo.
    if (createError && !createError.message.includes("already exists")) {
      throw createError;
    }
  }
}

export async function ensureAvatarBucket(): Promise<void> {
  await ensureBucket(AVATAR_BUCKET, "5MB");
}

// Transcrições brutas, BDD/PBI final e wireframes de referência anexados a um
// Planeta (Fase N4) — mesmo padrão do bucket de avatares, só que público
// pra qualquer arquivo (texto, PDF, imagem) e com limite maior.
export async function ensurePlanetExamplesBucket(): Promise<void> {
  await ensureBucket(PLANET_EXAMPLES_BUCKET, "15MB");
}

// Extrai o path dentro do bucket a partir de uma URL pública do Supabase
// Storage (o formato é sempre .../storage/v1/object/public/<bucket>/<path>),
// pra poder apagar o arquivo de verdade quando o registro é excluído.
export function extractStoragePath(publicUrl: string, bucket: string): string | null {
  const marker = `/object/public/${bucket}/`;
  const idx = publicUrl.indexOf(marker);
  if (idx === -1) return null;
  return decodeURIComponent(publicUrl.slice(idx + marker.length));
}
