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

// Só o que a UI precisa da sessão pra decidir o que mostrar/habilitar.
export interface NovaUser {
  id: string;
  permissionLevel: PermissionLevel;
  contextNodeId: string | null;
}

export type FormModalState =
  | { mode: "create"; type: ContextNodeType; parentId: string | null }
  | { mode: "edit"; node: ApiContextNode };
