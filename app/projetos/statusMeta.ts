import type { ProjectStatus } from "./types";

export const PROJECT_STATUS_LABEL: Record<ProjectStatus, string> = {
  PLANEJAMENTO: "Planejamento",
  EM_EXECUCAO: "Em execução",
  EM_VALIDACAO: "Em validação",
  FINALIZADO: "Finalizado",
};

// Tom da pílula no tema claro (ver ui.tsx::Pill) — "Em execução" é verde,
// igual ao mockup Projetos.html.
export const PROJECT_STATUS_TONE: Record<ProjectStatus, "green" | "blue" | "gray" | "amber"> = {
  PLANEJAMENTO: "gray",
  EM_EXECUCAO: "green",
  EM_VALIDACAO: "amber",
  FINALIZADO: "blue",
};
