import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-helpers";
import AppFooter from "@/components/AppFooter";
import AppHeader from "@/components/AppHeader";
import AtividadesPanel from "./AtividadesPanel";

// /atividades: histórico (auditoria) das principais ações — Bridges, Wireframes,
// Projetos e mudanças na NOVA. Qualquer usuário autenticado; cada um vê só o
// que as suas Galáxias permitem (ADMIN vê tudo) — ver lib/activity/visibility.ts.
export default async function AtividadesPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login?callbackUrl=/atividades");
  }

  return (
    // TEMA CLARO só no conteúdo (mesmo padrão de /projetos): a cor do tema fica
    // no <main>, nunca no div externo que envolve o header.
    <div className="relative flex min-h-screen flex-col bg-[#F4F5F7]">
      <AppHeader />

      <main className="relative mx-auto w-full max-w-[1440px] flex-1 px-6 py-10 text-[#1D1F25] lg:px-10">
        <AtividadesPanel />
      </main>

      <div className="bg-[#0D0D0D]">
        <AppFooter />
      </div>
    </div>
  );
}
