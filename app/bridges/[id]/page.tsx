import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-helpers";
import AbstractBackground from "@/components/AbstractBackground";
import AppFooter from "@/components/AppFooter";
import AppHeader from "@/components/AppHeader";
import BridgeDetail from "./BridgeDetail";

// /bridges/[id]: tela de revisão do BDD/PBI (se pendente) ou resultado final
// (se já aprovado) — Bridge-1.
export default async function BridgeDetailPage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser();

  if (!user) {
    redirect(`/login?callbackUrl=/bridges/${params.id}`);
  }

  return (
    <div className="relative flex min-h-screen flex-col text-luminous-on-surface">
      <AbstractBackground />
      <AppHeader />

      <main className="relative mx-auto w-full max-w-4xl px-6 py-10 lg:px-10">
        <BridgeDetail bridgeId={params.id} />
      </main>

      <AppFooter />
    </div>
  );
}
