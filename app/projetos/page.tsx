import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-helpers";
import AppFooter from "@/components/AppFooter";
import AppHeader from "@/components/AppHeader";
import ProjetosPanel from "./ProjetosPanel";

// /projetos (Projeto-1): lista de Projetos + criação de um novo (nome +
// seleção múltipla de Bridges ainda sem Projeto). TEMA CLARO exclusivo de
// /projetos (conteúdo abaixo do header, que segue escuro) — ver ui.tsx.
export default async function ProjetosPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login?callbackUrl=/projetos");
  }

  return (
    <div className="relative flex min-h-screen flex-col bg-[#F4F5F7]">
      <AppHeader />

      <main className="relative mx-auto w-full max-w-[1480px] flex-1 px-6 py-8 text-[#1D1F25] lg:px-8">
        <ProjetosPanel />
      </main>

      {/* O logo do rodapé é claro — faixa escura pra continuar visível. */}
      <div className="bg-[#0D0D0D]">
        <AppFooter />
      </div>
    </div>
  );
}
