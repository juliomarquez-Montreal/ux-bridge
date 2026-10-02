import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-helpers";
import AppFooter from "@/components/AppFooter";
import AppHeader from "@/components/AppHeader";
import ProjectDetail from "./ProjectDetail";

// /projetos/[id] (Projeto-1): detalhe de um Projeto — abas Visão geral,
// Story Map, Sprints, Métricas, Decisões. Tudo buscado client-side por
// ProjectDetail. TEMA CLARO exclusivo de /projetos (header segue escuro).
export default async function ProjectPage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser();

  if (!user) {
    redirect(`/login?callbackUrl=/projetos/${params.id}`);
  }

  return (
    <div className="relative flex min-h-screen flex-col bg-[#F4F5F7]">
      <AppHeader />

      <main className="relative flex-1 text-[#1D1F25]">
        <ProjectDetail projectId={params.id} />
      </main>

      {/* O logo do rodapé é claro — faixa escura pra continuar visível. */}
      <div className="bg-[#0D0D0D]">
        <AppFooter />
      </div>
    </div>
  );
}
