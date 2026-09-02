import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-helpers";
import GlassCard from "@/components/GlassCard";
import SettingsTabs from "./SettingsTabs";

// Tela de Ajustes, restrita a ADMIN. A checagem aqui é a segunda camada
// (a primeira é o middleware); as rotas de API fazem sua própria checagem também.
export default async function SettingsPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login?callbackUrl=/settings");
  }

  if (user.role !== "ADMIN") {
    return (
      <div className="grid min-h-screen place-items-center bg-luminous-background px-6 text-luminous-on-surface">
        <GlassCard className="max-w-md text-center">
          <h1 className="font-sora text-xl font-semibold">Acesso restrito</h1>
          <p className="mt-2 text-sm text-luminous-on-surface-variant">
            Esta área é exclusiva para administradores. Fale com um ADMIN do squad se precisar de acesso.
          </p>
        </GlassCard>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-luminous-background px-6 py-10 text-luminous-on-surface lg:px-8">
      <div className="mx-auto max-w-3xl">
        <h1 className="mb-6 font-sora text-3xl font-bold">Ajustes</h1>
        <SettingsTabs />
      </div>
    </div>
  );
}
