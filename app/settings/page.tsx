import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-helpers";
import AbstractBackground from "@/components/AbstractBackground";
import AppFooter from "@/components/AppFooter";
import AppHeader from "@/components/AppHeader";
import SettingsTabs from "./SettingsTabs";

// Tela de Ajustes: qualquer usuário logado acessa (edita o próprio perfil na
// aba PERFIL). A aba ENGINE só aparece/funciona para permissionLevel=ADMIN
// (a checagem real acontece na API — ver app/api/admin/settings/engine).
export default async function SettingsPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login?callbackUrl=/settings");
  }

  return (
    <div className="relative flex min-h-screen flex-col text-luminous-on-surface">
      <AbstractBackground />
      <AppHeader />

      <main className="relative mx-auto w-full max-w-3xl px-6 py-10 lg:px-8">
        <h1 className="mb-6 font-sora text-3xl font-bold">Ajustes</h1>
        <SettingsTabs isAdmin={user.permissionLevel === "ADMIN"} />
      </main>

      <AppFooter />
    </div>
  );
}
