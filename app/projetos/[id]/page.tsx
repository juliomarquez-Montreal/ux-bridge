import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-helpers";
import AbstractBackground from "@/components/AbstractBackground";
import AppFooter from "@/components/AppFooter";
import AppHeader from "@/components/AppHeader";
import ProjectDetail from "./ProjectDetail";

// /projetos/[id] (Projeto-1): detalhe de um Projeto — abas Visão geral,
// Story Map, Sprints, Métricas, Decisões. Tudo buscado client-side por
// ProjectDetail (mesmo padrão de BridgeDetail/WireframeEditorPage).
export default async function ProjectPage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser();

  if (!user) {
    redirect(`/login?callbackUrl=/projetos/${params.id}`);
  }

  return (
    <div className="relative flex min-h-screen flex-col text-luminous-on-surface">
      <AbstractBackground />
      <AppHeader />

      <main className="relative mx-auto w-full max-w-[1440px] px-6 py-10 lg:px-10">
        <ProjectDetail projectId={params.id} />
      </main>

      <AppFooter />
    </div>
  );
}
