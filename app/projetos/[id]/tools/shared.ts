import type { ApiProjectDetail, ApiToolsData } from "../../types";

export interface ToolProps {
  project: ApiProjectDetail;
  tools: ApiToolsData;
  reload: () => Promise<void>;
  onChanged: () => Promise<void>;
}

// Nome do Bridge pelo id; Bridge que saiu do Projeto aparece como removido.
export function bridgeName(project: ApiProjectDetail, bridgeId: string): string {
  return project.bridges.find((b) => b.id === bridgeId)?.planetName ?? "Bridge removido do Projeto";
}

export function isLinked(project: ApiProjectDetail, bridgeId: string): boolean {
  return project.bridges.some((b) => b.id === bridgeId);
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}
