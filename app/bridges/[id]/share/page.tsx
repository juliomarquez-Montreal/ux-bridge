import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { BRIDGE_WITH_PLANET_INCLUDE } from "@/lib/bridges/include";
import AppFooter from "@/components/AppFooter";
import AppHeader from "@/components/AppHeader";
import { Card, Pill } from "@/app/projetos/ui";
import { STATUS_LABEL, STATUS_TONE } from "../../statusMeta";
import type { BridgeStatus } from "../../types";

// /bridges/[id]/share: versão somente-leitura do Bridge, acessível a
// QUALQUER usuário autenticado no sistema — de propósito NÃO usa
// canAccessBridgeForPlanet (restrito por Galáxia), lendo o Bridge direto do
// banco aqui mesmo (Server Component), igual a rota .../shared faz pro
// client. Link permanente (sem expiração, sem token) pro ícone de
// compartilhar em /bridges: qualquer um com a URL e uma conta no sistema
// consegue abrir.
export default async function SharedBridgePage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) {
    redirect(`/login?callbackUrl=/bridges/${params.id}/share`);
  }

  const bridge = await db.bridge.findUnique({ where: { id: params.id }, include: BRIDGE_WITH_PLANET_INCLUDE });
  if (!bridge) {
    return (
      <div className="relative flex min-h-screen flex-col bg-[#F4F5F7]">
        <AppHeader />
        <main className="relative mx-auto w-full max-w-4xl flex-1 px-6 py-10 text-[#1D1F25] lg:px-10">
          <p className="text-sm text-[#C42B2B]">Bridge não encontrado.</p>
        </main>
        <div className="bg-[#0D0D0D]">
          <AppFooter />
        </div>
      </div>
    );
  }

  const galaxia = bridge.planet.parent?.parent;
  const estrela = bridge.planet.parent;
  const status = bridge.status as BridgeStatus;
  const isDraft = status !== "FINALIZADO";
  const hasWireframe = !!(bridge.wireframeData as { blocks?: unknown[] } | null)?.blocks?.length;

  return (
    <div className="relative flex min-h-screen flex-col bg-[#F4F5F7]">
      <AppHeader />

      <main className="relative mx-auto w-full max-w-4xl flex-1 px-6 py-10 text-[#1D1F25] lg:px-10">
        <Pill tone="purple">Link compartilhado — somente leitura</Pill>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold text-[#15161A]">{bridge.planet.name}</h1>
          <Pill tone={STATUS_TONE[status] === "done" ? "blue" : STATUS_TONE[status] === "error" ? "red" : "amber"}>{STATUS_LABEL[status]}</Pill>
        </div>
        <p className="mt-1 text-sm text-[#50545C]">
          {galaxia ? `${galaxia.name} / ` : ""}
          {estrela ? `${estrela.name} / ` : ""}
          {bridge.planet.name}
        </p>

        {isDraft && (
          <p className="mt-4 rounded-lg border border-[#F0DC9E] bg-[#FDF0CC] px-4 py-3 text-sm text-[#8A5A00]">
            Rascunho — ainda em revisão.
          </p>
        )}

        {bridge.generatedBddPbi && bridge.bddApprovedAt && (
          <Card className="mt-6 p-6">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[.05em] text-[#6B6F77]">Bridge Spec aprovado</p>
            <pre className="max-h-[50vh] overflow-y-auto whitespace-pre-wrap rounded-lg border border-[#E6E8EC] bg-[#FAFBFC] p-4 text-sm text-[#1D1F25]">
              {bridge.generatedBddPbi}
            </pre>
          </Card>
        )}

        <Card className="mt-4 p-6">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[.05em] text-[#6B6F77]">Wireframe</p>
          {hasWireframe ? (
            // eslint-disable-next-line @next/next/no-img-element -- SVG gerado dinamicamente pela própria API, não um asset estático otimizável pelo next/image
            <img
              src={`/api/bridges/${bridge.id}/shared/svg`}
              alt={`Wireframe de ${bridge.planet.name}`}
              className="w-full rounded-lg border border-[#E6E8EC] bg-white"
            />
          ) : (
            <p className="text-sm text-[#50545C]">Wireframe ainda não gerado.</p>
          )}
        </Card>
      </main>

      <div className="bg-[#0D0D0D]">
        <AppFooter />
      </div>
    </div>
  );
}
