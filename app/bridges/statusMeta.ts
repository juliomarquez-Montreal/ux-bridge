import type { BridgeStatus } from "./types";

export const STATUS_LABEL: Record<BridgeStatus, string> = {
  GERANDO_BDD: "Gerando BDD/PBI...",
  AGUARDANDO_APROVACAO_PO: "Aguardando aprovação",
  AGUARDANDO_WIREFRAME: "Aprovado",
  ERRO_GERACAO: "Erro na geração",
};

export const STATUS_BADGE_VARIANT: Record<BridgeStatus, "success" | "warning" | "info" | "neutral" | "error"> = {
  GERANDO_BDD: "info",
  AGUARDANDO_APROVACAO_PO: "warning",
  AGUARDANDO_WIREFRAME: "success",
  ERRO_GERACAO: "error",
};
