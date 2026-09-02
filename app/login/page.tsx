"use client";

import { Suspense, useState, type FormEvent } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import GlassCard from "@/components/GlassCard";
import PillButton from "@/components/PillButton";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const result = await signIn("credentials", {
      email: email.trim().toLowerCase(),
      password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError("Email ou senha inválidos.");
      return;
    }

    router.push(searchParams.get("callbackUrl") ?? "/");
    router.refresh();
  }

  return (
    <div className="grid min-h-screen place-items-center bg-luminous-background px-6 text-luminous-on-surface">
      <GlassCard className="w-full max-w-sm">
        <Image src="/Montreal-logo.png" alt="Montreal" width={126} height={28} className="mb-4" priority />
        <h1 className="mb-1 font-sora text-2xl font-bold">UX Bridge</h1>
        <p className="mb-6 text-sm text-luminous-on-surface-variant">Entrar na sua conta</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs uppercase tracking-[.1em] text-luminous-on-surface-variant" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none focus:border-luminous-primary"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs uppercase tracking-[.1em] text-luminous-on-surface-variant" htmlFor="password">
              Senha
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none focus:border-luminous-primary"
            />
          </div>

          {error && <p className="text-sm text-luminous-error">{error}</p>}

          <PillButton type="submit" className="w-full justify-center py-2.5" disabled={loading}>
            {loading ? "Entrando..." : "Entrar"}
          </PillButton>
        </form>
      </GlassCard>
    </div>
  );
}
