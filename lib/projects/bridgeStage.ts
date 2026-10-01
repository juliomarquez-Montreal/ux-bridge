// Mapeia o status real de um Bridge (app/bridges/types.ts::BridgeStatus) pra
// uma das 5 etapas do pipeline "Status dos Bridges" (Visão geral do
// Projeto) — nunca uma métrica paralela, só um agrupamento visual do mesmo
// campo Bridge.status que já existe. ERRO_GERACAO cai na etapa em que a
// geração falhou (antes ou depois do Bridge Spec aprovado, conforme
// bddApprovedAt), já que não é uma etapa própria do fluxo.
export const BRIDGE_STAGES = [
  "MATERIAL_ENVIADO",
  "BRIDGE_SPEC_APROVADO",
  "WIREFRAME_PO",
  "WIREFRAME_UX",
  "FINALIZADO",
] as const;
export type BridgeStage = (typeof BRIDGE_STAGES)[number];

export const BRIDGE_STAGE_LABEL: Record<BridgeStage, string> = {
  MATERIAL_ENVIADO: "Material enviado",
  BRIDGE_SPEC_APROVADO: "Bridge Spec aprovado",
  WIREFRAME_PO: "Wireframe PO",
  WIREFRAME_UX: "Wireframe UX",
  FINALIZADO: "Finalizado",
};

export function mapBridgeToStage(bridge: { status: string; bddApprovedAt: Date | string | null }): BridgeStage {
  switch (bridge.status) {
    case "GERANDO_BDD":
    case "AGUARDANDO_APROVACAO_BDD":
      return "MATERIAL_ENVIADO";
    case "GERANDO_WIREFRAME":
      return "BRIDGE_SPEC_APROVADO";
    case "AGUARDANDO_APROVACAO_WIREFRAME_PO":
      return "WIREFRAME_PO";
    case "AGUARDANDO_APROVACAO_UX":
      return "WIREFRAME_UX";
    case "FINALIZADO":
      return "FINALIZADO";
    case "ERRO_GERACAO":
      return bridge.bddApprovedAt ? "BRIDGE_SPEC_APROVADO" : "MATERIAL_ENVIADO";
    default:
      return "MATERIAL_ENVIADO";
  }
}
