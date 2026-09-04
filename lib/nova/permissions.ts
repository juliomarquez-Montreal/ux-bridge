import type { ContextNodeType, PermissionLevel } from "@prisma/client";
import { getAncestors } from "@/lib/context";

export interface PermissionUser {
  id: string;
  permissionLevel: PermissionLevel;
  contextNodeId: string | null;
}

export interface PermissionResult {
  allowed: boolean;
  reason?: string;
}

// Cada tipo só pode ser filho do tipo imediatamente acima na hierarquia.
// UNIVERSO não tem pai.
export const EXPECTED_PARENT_TYPE: Record<ContextNodeType, ContextNodeType | null> = {
  UNIVERSO: null,
  GALAXIA: "UNIVERSO",
  ESTRELA: "GALAXIA",
  PLANETA: "ESTRELA",
};

// Sobe a árvore a partir de um nó até achar o ancestral GALAXIA (inclui o
// próprio nó na busca, então funciona tanto pra "qual galáxia é essa Estrela"
// quanto pra "qual galáxia é o contextNodeId direto do usuário").
export async function getGalaxyAncestorId(nodeId: string): Promise<string | null> {
  const ancestors = await getAncestors(nodeId);
  return ancestors.find((node) => node.type === "GALAXIA")?.id ?? null;
}

export async function getUserGalaxyId(user: PermissionUser): Promise<string | null> {
  if (!user.contextNodeId) return null;
  return getGalaxyAncestorId(user.contextNodeId);
}

// Regra de criação: UNIVERSO/GALAXIA só ADMIN. ESTRELA/PLANETA qualquer
// usuário autenticado, mas só dentro da própria Galáxia (comparando a
// Galáxia ancestral do parentId alvo com a Galáxia do usuário). ADMIN pode
// criar em qualquer Galáxia.
export async function canCreateNode(input: {
  type: ContextNodeType;
  parentId: string | null;
  user: PermissionUser;
}): Promise<PermissionResult> {
  const { type, parentId, user } = input;

  if (user.permissionLevel === "ADMIN") return { allowed: true };

  if (type === "UNIVERSO" || type === "GALAXIA") {
    return { allowed: false, reason: "Só administradores podem criar Universo ou Galáxia." };
  }

  if (!parentId) {
    return { allowed: false, reason: "Nó pai é obrigatório para criar Estrela ou Planeta." };
  }

  const userGalaxyId = await getUserGalaxyId(user);
  if (!userGalaxyId) {
    return { allowed: false, reason: "Você não está vinculado a nenhuma Galáxia." };
  }

  const targetGalaxyId = await getGalaxyAncestorId(parentId);
  if (targetGalaxyId !== userGalaxyId) {
    return { allowed: false, reason: "Você só pode criar Estrela/Planeta dentro da sua própria Galáxia." };
  }

  return { allowed: true };
}

// Regra de edição/exclusão: mesmo escopo por Galáxia (sem dono de registro
// mais granular por enquanto). `nodeId` é o nó sendo editado/excluído.
export async function canModifyNode(input: {
  nodeId: string;
  nodeType: ContextNodeType;
  user: PermissionUser;
}): Promise<PermissionResult> {
  const { nodeId, nodeType, user } = input;

  if (user.permissionLevel === "ADMIN") return { allowed: true };

  if (nodeType === "UNIVERSO" || nodeType === "GALAXIA") {
    return { allowed: false, reason: "Só administradores podem editar ou excluir Universo ou Galáxia." };
  }

  const userGalaxyId = await getUserGalaxyId(user);
  if (!userGalaxyId) {
    return { allowed: false, reason: "Você não está vinculado a nenhuma Galáxia." };
  }

  const targetGalaxyId = await getGalaxyAncestorId(nodeId);
  if (targetGalaxyId !== userGalaxyId) {
    return { allowed: false, reason: "Você só pode editar/excluir dentro da sua própria Galáxia." };
  }

  return { allowed: true };
}
