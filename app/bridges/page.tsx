import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-helpers";
import AbstractBackground from "@/components/AbstractBackground";
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
    <div className="relative flex min-h-screen flex-col text-luminous-on-surface">
      <AbstractBackground />
      <AppHeader />

      <main className="relative mx-auto w-full max-w-[1440px] px-6 py-10 lg:px-10">
        <BridgesPanel />
      </main>

      <AppFooter />
    </div>
  );
}
