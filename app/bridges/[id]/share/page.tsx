import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { BRIDGE_WITH_PLANET_INCLUDE } from "@/lib/bridges/include";
import AbstractBackground from "@/components/AbstractBackground";
import AppFooter from "@/components/AppFooter";
import AppHeader from "@/components/AppHeader";
import Badge from "@/components/Badge";
import GlassCard from "@/components/GlassCard";
import { STATUS_BADGE_VARIANT, STATUS_LABEL } from "../../statusMeta";
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
      <div className="relative flex min-h-screen flex-col text-luminous-on-surface">
        <AbstractBackground />
        <AppHeader />
        <main className="relative mx-auto w-full max-w-4xl px-6 py-10 lg:px-10">
          <p className="text-sm text-luminous-error">Bridge não encontrado.</p>
        </main>
        <AppFooter />
      </div>
    );
  }

  const galaxia = bridge.planet.parent?.parent;
  const estrela = bridge.planet.parent;
  const status = bridge.status as BridgeStatus;
  const isDraft = status !== "FINALIZADO";
  const hasWireframe = !!(bridge.wireframeData as { blocks?: unknown[] } | null)?.blocks?.length;

  return (
    <div className="relative flex min-h-screen flex-col text-luminous-on-surface">
      <AbstractBackground />
      <AppHeader />

      <main className="relative mx-auto w-full max-w-4xl px-6 py-10 lg:px-10">
        <Badge variant="info">Link compartilhado — somente leitura</Badge>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold text-white">{bridge.planet.name}</h1>
          <Badge variant={STATUS_BADGE_VARIANT[status]}>{STATUS_LABEL[status]}</Badge>
        </div>
        <p className="mt-1 text-sm text-luminous-on-surface-variant">
          {galaxia ? `${galaxia.name} / ` : ""}
          {estrela ? `${estrela.name} / ` : ""}
          {bridge.planet.name}
        </p>

        {isDraft && (
          <p className="mt-4 rounded-lg border border-[#ffb688]/30 bg-[#ffb688]/10 px-4 py-3 text-sm text-[#ffb688]">
            Rascunho — ainda em revisão.
          </p>
        )}

        {bridge.generatedBddPbi && bridge.bddApprovedAt && (
          <GlassCard className="mt-6">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[.05em] text-luminous-on-surface-variant">Bridge Spec aprovado</p>
            <pre className="max-h-[50vh] overflow-y-auto whitespace-pre-wrap rounded-lg border border-white/10 bg-black/30 p-4 text-sm text-luminous-on-surface">
              {bridge.generatedBddPbi}
            </pre>
          </GlassCard>
        )}

        <GlassCard className="mt-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[.05em] text-luminous-on-surface-variant">Wireframe</p>
          {hasWireframe ? (
            // eslint-disable-next-line @next/next/no-img-element -- SVG gerado dinamicamente pela própria API, não um asset estático otimizável pelo next/image
            <img
              src={`/api/bridges/${bridge.id}/shared/svg`}
              alt={`Wireframe de ${bridge.planet.name}`}
              className="w-full rounded-lg border border-white/10 bg-white"
            />
          ) : (
            <p className="text-sm text-luminous-on-surface-variant">Wireframe ainda não gerado.</p>
          )}
        </GlassCard>
      </main>

      <AppFooter />
    </div>
  );
}
