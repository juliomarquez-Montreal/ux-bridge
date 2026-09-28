import type { ContextNodeType, PermissionLevel } from "@prisma/client";

// Formato retornado por GET /api/nova/nodes (árvore aninhada) — espelha
// TreeNode de app/api/nova/nodes/route.ts.
export interface ApiContextNode {
  id: string;
  type: ContextNodeType;
  name: string;
  parentId: string | null;
  planetTypeId: string | null;
  children: ApiContextNode[];
}

export interface ApiPlanetType {
  id: string;
  name: string;
  description: string | null;
}

export type ExampleKind = "RAW_TRANSCRIPT" | "FINAL_BDD_PBI" | "WIREFRAME_REFERENCE";

export interface ApiPlanetExample {
  id: string;
  contextNodeId: string;
  kind: ExampleKind;
  // RAW_TRANSCRIPT e WIREFRAME_REFERENCE usam estes dois.
  fileUrl: string | null;
  textContent: string | null;
  // Só FINAL_BDD_PBI: par inicial/final, cada lado independentemente opcional.
  initialTextContent: string | null;
  initialFileUrl: string | null;
  finalTextContent: string | null;
  finalFileUrl: string | null;
  // Só WIREFRAME_REFERENCE.
  referenceType: string | null;
  uploadedById: string | null;
  createdAt: string;
}

export interface ApiDesignSystemComponent {
  id: string;
  name: string;
  figmaComponentKey: string | null;
  thumbnailUrl: string | null;
  description: string | null;
  createdAt: string;
}

export interface ApiDesignSystemGalaxyLink {
  galaxyId: string;
  galaxyName: string;
}

// N:N com Galáxia via DesignSystemGalaxyLink — uma fonte não "pertence" mais
// a uma única Galáxia, pode estar vinculada a várias (ou nenhuma ainda).
export interface ApiDesignSystemSource {
  id: string;
  name: string;
  figmaFileKey: string;
  figmaUrl: string;
  lastSyncedAt: string | null;
  addedById: string | null;
  createdAt: string;
  components: ApiDesignSystemComponent[];
  galaxyLinks: ApiDesignSystemGalaxyLink[];
}

export interface DesignSystemSyncResult {
  created: number;
  updated: number;
  totalSynced: number;
  missingFromLastSync: number;
  warning?: string | null;
}

// Só o que a UI precisa da sessão pra decidir o que mostrar/habilitar.
// Acesso a Galáxia não vem mais daqui (era contextNodeId, uma só Galáxia) —
// é buscado à parte via GET /api/nova/users/me/galaxies (Fase N7).
export interface NovaUser {
  id: string;
  permissionLevel: PermissionLevel;
}

// Resposta de GET /api/nova/users/me/galaxies — Galáxias que o usuário pode
// selecionar no seletor do header, com o Universo pai pra montar a busca em
// duas etapas (Universo -> Galáxia).
export interface ApiUserGalaxy {
  id: string;
  name: string;
  universoId: string;
  universoName: string;
}

export type FormModalState =
  | { mode: "create"; type: ContextNodeType; parentId: string | null }
  | { mode: "edit"; node: ApiContextNode };
