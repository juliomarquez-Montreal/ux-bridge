import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-helpers";
import AbstractBackground from "@/components/AbstractBackground";
import AppFooter from "@/components/AppFooter";
import AppHeader from "@/components/AppHeader";
import GlassCard from "@/components/GlassCard";
import EnginePanel from "./EnginePanel";

// Ajustes do sistema: só o engine de IA por enquanto, restrito a ADMIN.
// Perfil pessoal (nome, foto, email, senha) mora em /profile, aberto a
// qualquer usuário logado.
export default async function SettingsPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login?callbackUrl=/settings");
  }

  const content =
    user.permissionLevel === "ADMIN" ? (
      <EnginePanel />
    ) : (
      <GlassCard className="max-w-md text-center">
        <h2 className="font-sora text-lg font-semibold">Acesso restrito</h2>
        <p className="mt-2 text-sm text-luminous-on-surface-variant">
          Esta área é exclusiva para administradores. Fale com um ADMIN do squad se precisar de acesso.
        </p>
      </GlassCard>
    );

  return (
    <div className="relative flex min-h-screen flex-col text-luminous-on-surface">
      <AbstractBackground />
      <AppHeader />

      <main className="relative mx-auto w-full max-w-3xl px-6 py-10 lg:px-8">
        <h1 className="mb-6 font-sora text-3xl font-bold">Ajustes</h1>
        {content}
      </main>

      <AppFooter />
    </div>
  );
}
