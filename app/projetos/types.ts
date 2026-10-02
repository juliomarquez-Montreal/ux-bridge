export type ProjectStatus = "PLANEJAMENTO" | "EM_EXECUCAO" | "EM_VALIDACAO" | "FINALIZADO";
export type ProjectMemberRole = "PO" | "UX";

export interface ApiProjectBridge {
  id: string;
  status: string;
  bddApprovedAt: string | null;
  createdAt: string;
  planetName: string;
  estrelaName: string | null;
  galaxiaName: string | null;
  linkedAt: string;
  // Etiqueta livre de área (Mapa de Áreas) e se já tem Bridge Spec gerado.
  area: string | null;
  hasSpec: boolean;
}

export interface ApiProjectMember {
  id: string;
  userId: string;
  name: string;
  avatarUrl: string | null;
  role: ProjectMemberRole;
  addedAt: string;
}

export interface ApiProjectSprint {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  notes: string | null;
  createdAt: string;
}

export interface ApiProjectDecision {
  id: string;
  text: string;
  authorId: string;
  authorName: string;
  createdAt: string;
}

// Resumo usado na listagem /projetos (sem puxar membros/sprints/decisões
// inteiros, só a contagem de Bridges vinculados).
export interface ApiProjectSummary {
  id: string;
  code: string;
  name: string;
  objective: string | null;
  status: ProjectStatus;
  createdById: string;
  createdByName: string;
  createdAt: string;
  bridgeCount: number;
  // Só vem na listagem (GET /api/projetos): o usuário pode gerenciar/apagar?
  canManage?: boolean;
}

export interface ApiProjectDetail extends ApiProjectSummary {
  bridges: ApiProjectBridge[];
  members: ApiProjectMember[];
  sprints: ApiProjectSprint[];
  decisions: ApiProjectDecision[];
}

// Bridge ainda sem Projeto, pro seletor de "Vincular Bridge" — mesmo shape
// mínimo usado em BridgesPanel, sem os campos de progresso/ações daquela tela.
export interface ApiUnlinkedBridge {
  id: string;
  status: string;
  createdAt: string;
  planetName: string;
  estrelaName: string | null;
  galaxiaName: string | null;
}

export interface ApiProjectUser {
  id: string;
  name: string;
  avatarUrl: string | null;
}

// ---- Ferramentas do PO (Projeto-2) ----

export interface ApiScopeAnalysis {
  bridgeId: string;
  aligned: boolean;
  explanation: string;
  analyzedAt: string;
}

export interface ApiConflict {
  bridgeIdA: string;
  bridgeIdB: string;
  description: string;
}

export interface ApiConflictAnalysis {
  analyzedAt: string;
  conflicts: ApiConflict[];
}

export interface ApiBridgeDependency {
  id: string;
  bridgeId: string;
  dependsOnBridgeId: string;
  note: string | null;
  createdByName: string;
  createdAt: string;
}

export interface ApiComparisonNote {
  id: string;
  bridgeIds: string[];
  note: string;
  authorName: string;
  createdAt: string;
}

export interface ApiToolsData {
  scopeAnalyses: ApiScopeAnalysis[];
  conflictAnalysis: ApiConflictAnalysis | null;
  dependencies: ApiBridgeDependency[];
  comparisonNotes: ApiComparisonNote[];
}

export interface ApiBridgeSpec {
  bridgeId: string;
  name: string;
  spec: string | null;
}
