import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-helpers";
import AbstractBackground from "@/components/AbstractBackground";
import AppFooter from "@/components/AppFooter";
import AppHeader from "@/components/AppHeader";
import ProfilePanel from "./ProfilePanel";

// Meu perfil: qualquer usuário autenticado edita os próprios dados aqui
// (nome, função, foto, email, senha). Separado de /settings, que agora é
// só a configuração do sistema (engine de IA), restrita a ADMIN.
export default async function ProfilePage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login?callbackUrl=/profile");
  }

  return (
    <div className="relative flex min-h-screen flex-col text-luminous-on-surface">
      <AbstractBackground />
      <AppHeader />

      <main className="relative mx-auto w-full max-w-3xl px-6 py-10 lg:px-8">
        <h1 className="mb-6 font-sora text-3xl font-bold">Meu perfil</h1>
        <ProfilePanel />
      </main>

      <AppFooter />
    </div>
  );
}
