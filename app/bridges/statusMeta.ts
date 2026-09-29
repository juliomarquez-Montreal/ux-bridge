import type { BridgeStatus } from "./types";

export const STATUS_LABEL: Record<BridgeStatus, string> = {
  GERANDO_BDD: "Gerando BDD/PBI...",
  AGUARDANDO_APROVACAO_BDD: "Aguardando aprovação do BDD/PBI",
  GERANDO_SKETCH: "Gerando sketch...",
  AGUARDANDO_APROVACAO_SKETCH: "Aguardando aprovação do sketch",
  AGUARDANDO_WIREFRAME: "Finalizado",
  ERRO_GERACAO: "Erro na geração",
};

export const STATUS_BADGE_VARIANT: Record<BridgeStatus, "success" | "warning" | "info" | "neutral" | "error"> = {
  GERANDO_BDD: "info",
  AGUARDANDO_APROVACAO_BDD: "warning",
  GERANDO_SKETCH: "info",
  AGUARDANDO_APROVACAO_SKETCH: "warning",
  AGUARDANDO_WIREFRAME: "success",
  ERRO_GERACAO: "error",
};

// Tom semântico por status, pra tela /bridges (cards de estatística + badge
// de status da tabela): âmbar pra tudo que ainda está em andamento/
// aguardando aprovação, azul pra finalizado, vermelho pra erro.
export type StatusTone = "pending" | "done" | "error";
export const STATUS_TONE: Record<BridgeStatus, StatusTone> = {
  GERANDO_BDD: "pending",
  AGUARDANDO_APROVACAO_BDD: "pending",
  GERANDO_SKETCH: "pending",
  AGUARDANDO_APROVACAO_SKETCH: "pending",
  AGUARDANDO_WIREFRAME: "done",
  ERRO_GERACAO: "error",
};

// Percentual de conclusão por status — mapeamento fixo e progressivo (não
// uma medição real de tempo/esforço). ERRO_GERACAO não está aqui porque
// depende de em qual etapa a falha aconteceu — ver progressForBridge.
export const STATUS_PROGRESS: Record<Exclude<BridgeStatus, "ERRO_GERACAO">, number> = {
  GERANDO_BDD: 15,
  AGUARDANDO_APROVACAO_BDD: 35,
  GERANDO_SKETCH: 55,
  AGUARDANDO_APROVACAO_SKETCH: 75,
  AGUARDANDO_WIREFRAME: 100,
};

// bddApprovedAt já preenchido em ERRO_GERACAO indica que a falha aconteceu
// na etapa do Sketch (o BDD já tinha sido aprovado); senão a falha foi na
// etapa do BDD — mesma lógica já usada pra decidir o retry (ver
// app/api/bridges/[id]/retry/route.ts).
export function progressForBridge(bridge: { status: BridgeStatus; bddApprovedAt: string | null }): number {
  if (bridge.status === "ERRO_GERACAO") return bridge.bddApprovedAt ? 55 : 15;
  return STATUS_PROGRESS[bridge.status];
}
