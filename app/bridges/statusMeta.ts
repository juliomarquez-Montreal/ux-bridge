import type { BridgeStatus } from "./types";

export const STATUS_LABEL: Record<BridgeStatus, string> = {
  GERANDO_BDD: "Gerando BDD/PBI...",
  AGUARDANDO_APROVACAO_BDD: "Aguardando aprovação do BDD/PBI",
  GERANDO_SKETCH: "Gerando sketch...",
  AGUARDANDO_APROVACAO_SKETCH: "Aguardando aprovação do sketch",
  AGUARDANDO_WIREFRAME: "Aprovado",
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
