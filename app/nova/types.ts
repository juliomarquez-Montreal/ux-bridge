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
  fileUrl: string | null;
  textContent: string | null;
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
export interface NovaUser {
  id: string;
  permissionLevel: PermissionLevel;
  contextNodeId: string | null;
}

export type FormModalState =
  | { mode: "create"; type: ContextNodeType; parentId: string | null }
  | { mode: "edit"; node: ApiContextNode };
