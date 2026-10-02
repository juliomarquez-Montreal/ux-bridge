import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-helpers";
import AppFooter from "@/components/AppFooter";
import AppHeader from "@/components/AppHeader";
import BridgesPanel from "./BridgesPanel";

// /bridges: lista de todos os Bridges do usuário (ou de todos, se ADMIN),
// com busca, filtro por status, ordenação, paginação e exclusão. O botão
// "olho" de cada linha leva pra /bridges/[id] (revisão pendente ou
// resultado final, dependendo do status).
export default async function BridgesPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login?callbackUrl=/bridges");
  }

  return (
    // TEMA CLARO só no conteúdo (mesmo padrão de /projetos): a cor do tema fica
    // no <main>, nunca no div externo que envolve o header (senão vaza pro
    // header, que é sempre escuro). O rodapé fica numa faixa escura.
    <div className="relative flex min-h-screen flex-col bg-[#F4F5F7]">
      <AppHeader />

      <main className="relative mx-auto w-full max-w-[1440px] flex-1 px-6 py-10 text-[#1D1F25] lg:px-10">
        <BridgesPanel />
      </main>

      <div className="bg-[#0D0D0D]">
        <AppFooter />
      </div>
    </div>
  );
}
