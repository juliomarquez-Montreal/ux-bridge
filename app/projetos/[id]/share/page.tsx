import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { BRIDGE_STAGES, BRIDGE_STAGE_LABEL, mapBridgeToStage, type BridgeStage } from "@/lib/projects/bridgeStage";
import AppFooter from "@/components/AppFooter";
import AppHeader from "@/components/AppHeader";
import { Card, CardTitle, Pill } from "../../ui";
import { PROJECT_STATUS_LABEL, PROJECT_STATUS_TONE } from "../../statusMeta";
import type { ProjectStatus } from "../../types";

const STAGE_BAR_COLOR: Record<BridgeStage, string> = {
  MATERIAL_ENVIADO: "#D3D5DA",
  BRIDGE_SPEC_APROVADO: "#8DBBF7",
  WIREFRAME_PO: "#2F7CF6",
  WIREFRAME_UX: "#8F5CF6",
  FINALIZADO: "#3DBB6A",
};

const STAGE_PILL_TONE: Record<BridgeStage, "gray" | "blue" | "amber" | "purple" | "green"> = {
  MATERIAL_ENVIADO: "gray",
  BRIDGE_SPEC_APROVADO: "blue",
  WIREFRAME_PO: "amber",
  WIREFRAME_UX: "purple",
  FINALIZADO: "green",
};

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-col bg-[#F4F5F7] text-[#1D1F25]">
      <AppHeader />
      <main className="relative mx-auto w-full max-w-4xl flex-1 px-6 py-8 lg:px-8">{children}</main>
      <div className="bg-[#0D0D0D]">
        <AppFooter />
      </div>
    </div>
  );
}

// /projetos/[id]/share: versão somente-leitura do Projeto (objetivo, status
// e pipeline dos Bridges vinculados), acessível a QUALQUER usuário
// autenticado — de propósito NÃO exige acesso à Galáxia de cada Bridge nem
// ser da equipe: lê direto do banco (Server Component), mesmo padrão de
// /bridges/[id]/share. Link permanente, sem token nem expiração. Não expõe
// o conteúdo dos Bridge Specs, só nome e etapa de cada Bridge.
export default async function SharedProjectPage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) {
    redirect(`/login?callbackUrl=/projetos/${params.id}/share`);
  }

  const project = await db.project.findUnique({
    where: { id: params.id },
    include: {
      bridgeLinks: {
        orderBy: [{ linkedAt: "asc" }, { id: "asc" }],
        include: { bridge: { select: { status: true, bddApprovedAt: true, planet: { select: { name: true } } } } },
      },
    },
  });

  if (!project) {
    return (
      <Shell>
        <p className="text-sm text-[#C42B2B]">Projeto não encontrado.</p>
      </Shell>
    );
  }

  const creator = await db.user.findUnique({ where: { id: project.createdById }, select: { name: true } });
  const status = project.status as ProjectStatus;

  const bridges = project.bridgeLinks.map((link) => ({
    id: link.bridgeId,
    name: link.bridge.planet.name,
    stage: mapBridgeToStage(link.bridge),
  }));
  const stageCounts = Object.fromEntries(BRIDGE_STAGES.map((s) => [s, bridges.filter((b) => b.stage === s).length])) as Record<BridgeStage, number>;
  const maxCount = Math.max(1, ...BRIDGE_STAGES.map((s) => stageCounts[s]));

  return (
    <Shell>
      <Pill tone="purple">Link compartilhado — somente leitura</Pill>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <h1 className="text-[30px] font-bold leading-tight text-[#15161A]">{project.name}</h1>
        <span className="rounded-[6px] bg-[#EEF0F3] px-2.5 py-1 text-[13px] text-[#52565E]">{project.code}</span>
        <Pill tone={PROJECT_STATUS_TONE[status]}>{PROJECT_STATUS_LABEL[status]}</Pill>
      </div>
      <p className="mt-1.5 text-[13px] text-[#6B6F77]">
        Criado por {creator?.name ?? "—"} em {project.createdAt.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })} ·{" "}
        {bridges.length} Bridge(s) vinculado(s)
      </p>

      <Card className="mt-6 p-5">
        <CardTitle>Objetivo do projeto</CardTitle>
        <p className="mt-3 whitespace-pre-wrap text-[14.5px] text-[#1D1F25]">
          {project.objective ?? <span className="text-[#50545C]">Nenhum objetivo definido ainda.</span>}
        </p>
      </Card>

      <Card className="mt-4 p-5">
        <CardTitle>Status dos Bridges</CardTitle>
        <div className="mt-4 space-y-3">
          {BRIDGE_STAGES.map((stage) => (
            <div key={stage} className="flex items-center gap-3">
              <span className="w-[150px] shrink-0 text-[14px] text-[#1D1F25]">{BRIDGE_STAGE_LABEL[stage]}</span>
              <div className="h-[18px] flex-1">
                <div
                  className="h-full rounded-[4px]"
                  style={{
                    width: `${(stageCounts[stage] / maxCount) * 100}%`,
                    minWidth: stageCounts[stage] > 0 ? 6 : 0,
                    backgroundColor: STAGE_BAR_COLOR[stage],
                  }}
                />
              </div>
              <span className="w-6 text-right text-[14.5px] font-semibold text-[#1D1F25]">{stageCounts[stage]}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card className="mt-4 p-5">
        <CardTitle>Bridges vinculados</CardTitle>
        {bridges.length === 0 ? (
          <p className="mt-3 text-sm text-[#50545C]">Nenhum Bridge vinculado.</p>
        ) : (
          <ul className="mt-3 divide-y divide-[#EEF0F3]">
            {bridges.map((bridge) => (
              <li key={bridge.id} className="flex items-center justify-between gap-3 py-2.5">
                <span className="text-[14.5px] font-medium text-[#1D1F25]">{bridge.name}</span>
                <Pill tone={STAGE_PILL_TONE[bridge.stage]}>{BRIDGE_STAGE_LABEL[bridge.stage]}</Pill>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </Shell>
  );
}
