import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-helpers";
import AbstractBackground from "@/components/AbstractBackground";
import AppFooter from "@/components/AppFooter";
import AppHeader from "@/components/AppHeader";
import ProjetosPanel from "./ProjetosPanel";

// /projetos (Projeto-1): lista de Projetos existentes + criação de um novo
// (nome + seleção múltipla de Bridges ainda sem Projeto).
export default async function ProjetosPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login?callbackUrl=/projetos");
  }

  return (
    <div className="relative flex min-h-screen flex-col text-luminous-on-surface">
      <AbstractBackground />
      <AppHeader />

      <main className="relative mx-auto w-full max-w-[1440px] px-6 py-10 lg:px-10">
        <ProjetosPanel />
      </main>

      <AppFooter />
    </div>
  );
}
