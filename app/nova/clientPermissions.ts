import type { ContextNodeType } from "@prisma/client";
import type { ApiContextNode, NovaUser } from "./types";

// Regras de UI apenas — decidem o que mostrar/habilitar na tela. A permissão
// de verdade é sempre revalidada pela API (lib/nova/permissions.ts no
// servidor); se a árvore em memória estiver desatualizada e o usuário
// clicar em algo que não pode mais fazer, a API ainda recusa com 403/409 e
// a UI mostra o erro — nunca confiamos só nisto aqui.

export const CHILD_TYPE: Record<ContextNodeType, ContextNodeType | null> = {
  UNIVERSO: "GALAXIA",
  GALAXIA: "ESTRELA",
  ESTRELA: "PLANETA",
  PLANETA: null,
};

export const TYPE_LABEL: Record<ContextNodeType, string> = {
  UNIVERSO: "Universo",
  GALAXIA: "Galáxia",
  ESTRELA: "Estrela",
  PLANETA: "Planeta",
};

export function flattenTree(roots: ApiContextNode[]): Map<string, ApiContextNode> {
  const map = new Map<string, ApiContextNode>();
  function walk(nodes: ApiContextNode[]) {
    for (const node of nodes) {
      map.set(node.id, node);
      walk(node.children);
    }
  }
  walk(roots);
  return map;
}

// Sobe a árvore via parentId a partir de um nó até achar o ancestral do tipo
// Galáxia — mesma lógica de lib/nova/permissions.ts::getGalaxyAncestorId,
// só que operando sobre a árvore já carregada em memória em vez do banco.
export function getGalaxyAncestorId(nodeId: string, byId: Map<string, ApiContextNode>): string | null {
  let current = byId.get(nodeId);
  while (current) {
    if (current.type === "GALAXIA") return current.id;
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  return null;
}

export function canCreateUniverso(user: NovaUser): boolean {
  return user.permissionLevel === "ADMIN";
}

// Pode criar um filho dentro de `parent`? (o tipo do filho é CHILD_TYPE[parent.type])
export function canCreateChildOf(
  parent: ApiContextNode,
  user: NovaUser,
  userGalaxyId: string | null,
  byId: Map<string, ApiContextNode>
): boolean {
  const childType = CHILD_TYPE[parent.type];
  if (!childType) return false; // Planeta não tem filho
  if (user.permissionLevel === "ADMIN") return true;
  if (childType === "GALAXIA") return false; // só ADMIN cria Galáxia (filha de Universo)
  if (!userGalaxyId) return false;
  return getGalaxyAncestorId(parent.id, byId) === userGalaxyId;
}

export function canModifyNode(
  node: ApiContextNode,
  user: NovaUser,
  userGalaxyId: string | null,
  byId: Map<string, ApiContextNode>
): boolean {
  if (user.permissionLevel === "ADMIN") return true;
  if (node.type === "UNIVERSO" || node.type === "GALAXIA") return false;
  if (!userGalaxyId) return false;
  return getGalaxyAncestorId(node.id, byId) === userGalaxyId;
}
