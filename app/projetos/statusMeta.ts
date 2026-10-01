import type { ProjectStatus } from "./types";

export const PROJECT_STATUS_LABEL: Record<ProjectStatus, string> = {
  PLANEJAMENTO: "Planejamento",
  EM_EXECUCAO: "Em execução",
  EM_VALIDACAO: "Em validação",
  FINALIZADO: "Finalizado",
};

export const PROJECT_STATUS_BADGE_VARIANT: Record<ProjectStatus, "success" | "warning" | "info" | "neutral" | "error"> = {
  PLANEJAMENTO: "neutral",
  EM_EXECUCAO: "info",
  EM_VALIDACAO: "warning",
  FINALIZADO: "success",
};
