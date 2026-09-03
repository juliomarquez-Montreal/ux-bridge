import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const AVATAR_BUCKET = "avatars";

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

export async function ensureAvatarBucket(): Promise<void> {
  const admin = getSupabaseAdmin();
  const { data: buckets, error } = await admin.storage.listBuckets();
  if (error) throw error;

  if (!buckets?.some((bucket) => bucket.name === AVATAR_BUCKET)) {
    const { error: createError } = await admin.storage.createBucket(AVATAR_BUCKET, {
      public: true,
      fileSizeLimit: "5MB",
    });
    // Ignora corrida entre duas requisições tentando criar o bucket ao mesmo tempo.
    if (createError && !createError.message.includes("already exists")) {
      throw createError;
    }
  }
}
