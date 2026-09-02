import { getServerSession, type Session } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function getCurrentUser(): Promise<Session["user"] | null> {
  const session = await getServerSession(authOptions);
  return session?.user ?? null;
}

export async function requireAdmin(): Promise<
  { ok: true; user: Session["user"] } | { ok: false; status: 401 | 403 }
> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, status: 401 };
  if (user.role !== "ADMIN") return { ok: false, status: 403 };
  return { ok: true, user };
}
