import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import AbstractBackground from "@/components/AbstractBackground";
import AppFooter from "@/components/AppFooter";
import AppHeader from "@/components/AppHeader";
import BridgeDetail from "./BridgeDetail";
import WireframeEditorPage from "./WireframeEditorPage";

// /bridges/[id]: tela de revisão do BDD/PBI (se pendente), editor de
// Wireframe em tela cheia (se aguardando aprovação do PO — Wireframe-1a) ou
// resultado final (se já aprovado/aguardando UX). Decide a casca aqui, no
// Server Component, checando o status ANTES de renderizar — o editor de
// Wireframe é uma experiência full-bleed (sem o container centralizado
// max-w-4xl nem o rodapé), então não cabe dentro da casca normal.
export default async function BridgeDetailPage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser();

  if (!user) {
    redirect(`/login?callbackUrl=/bridges/${params.id}`);
  }

  const bridge = await db.bridge.findUnique({ where: { id: params.id }, select: { status: true } });
  const isWireframeEditing = bridge?.status === "AGUARDANDO_APROVACAO_WIREFRAME_PO";

  if (isWireframeEditing) {
    return (
      <div className="flex h-screen flex-col overflow-hidden text-luminous-on-surface">
        <AppHeader />
        <div className="min-h-0 flex-1">
          <WireframeEditorPage bridgeId={params.id} />
        </div>
      </div>
    );
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
