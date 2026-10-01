import type { ContextNodeType, PermissionLevel } from "@prisma/client";
import { getAncestors } from "@/lib/context";
import { db } from "@/lib/db";

export interface PermissionUser {
  id: string;
  permissionLevel: PermissionLevel;
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
// quanto pra "qual galáxia é este nó direto").
export async function getGalaxyAncestorId(nodeId: string): Promise<string | null> {
  const ancestors = await getAncestors(nodeId);
  return ancestors.find((node) => node.type === "GALAXIA")?.id ?? null;
}

// Galáxias às quais este usuário (não-ADMIN) tem acesso — Fase N7:
// substitui o antigo "uma única Galáxia fixa" (User.contextNodeId) por N:N
// via UserGalaxyAccess. Consulta o banco direto (não a sessão), pra um
// acesso concedido/revogado por um ADMIN valer imediatamente, sem precisar
// logar de novo.
export async function getUserGalaxyIds(user: PermissionUser): Promise<string[]> {
  const rows = await db.userGalaxyAccess.findMany({ where: { userId: user.id }, select: { galaxyId: true } });
  return rows.map((row) => row.galaxyId);
}

// Regra de criação: UNIVERSO/GALAXIA só ADMIN. ESTRELA/PLANETA qualquer
// usuário autenticado, mas só dentro de uma Galáxia à qual ele tem acesso
// (comparando a Galáxia ancestral do parentId alvo com as Galáxias do
// usuário). ADMIN pode criar em qualquer Galáxia.
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

  const targetGalaxyId = await getGalaxyAncestorId(parentId);
  if (!targetGalaxyId) {
    return { allowed: false, reason: "Não foi possível determinar a Galáxia do nó pai." };
  }

  const userGalaxyIds = await getUserGalaxyIds(user);
  if (userGalaxyIds.length === 0) {
    return { allowed: false, reason: "Você não tem acesso a nenhuma Galáxia." };
  }

  if (!userGalaxyIds.includes(targetGalaxyId)) {
    return { allowed: false, reason: "Você só pode criar Estrela/Planeta em Galáxias às quais tem acesso." };
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

  const targetGalaxyId = await getGalaxyAncestorId(nodeId);
  if (!targetGalaxyId) {
    return { allowed: false, reason: "Não foi possível determinar a Galáxia deste nó." };
  }

  const userGalaxyIds = await getUserGalaxyIds(user);
  if (userGalaxyIds.length === 0) {
    return { allowed: false, reason: "Você não tem acesso a nenhuma Galáxia." };
  }

  if (!userGalaxyIds.includes(targetGalaxyId)) {
    return { allowed: false, reason: "Você só pode editar/excluir em Galáxias às quais tem acesso." };
  }

  return { allowed: true };
}

// Regra pra recursos anexados diretamente a uma Galáxia (Fase N5: fontes de
// Design System) — mesmo escopo de criar/editar Estrela/Planeta: ADMIN em
// qualquer Galáxia, usuário comum só nas que tem acesso.
export async function canManageGalaxy(input: { galaxyId: string; user: PermissionUser }): Promise<PermissionResult> {
  const { galaxyId, user } = input;

  if (user.permissionLevel === "ADMIN") return { allowed: true };

  const userGalaxyIds = await getUserGalaxyIds(user);
  if (userGalaxyIds.length === 0) {
    return { allowed: false, reason: "Você não tem acesso a nenhuma Galáxia." };
  }

  if (!userGalaxyIds.includes(galaxyId)) {
    return { allowed: false, reason: "Você só pode gerenciar recursos em Galáxias às quais tem acesso." };
  }

  return { allowed: true };
}

// Regra pra criar/ver/aprovar um Bridge (Bridge-1) a partir de um Planeta —
// mesmo escopo de criar Estrela/Planeta: ADMIN em qualquer Galáxia, usuário
// comum só na(s) que tem acesso. `planetId` é o ContextNode do tipo PLANETA.
export async function canAccessBridgeForPlanet(input: { planetId: string; user: PermissionUser }): Promise<PermissionResult> {
  const { planetId, user } = input;

  if (user.permissionLevel === "ADMIN") return { allowed: true };

  const galaxyId = await getGalaxyAncestorId(planetId);
  if (!galaxyId) {
    return { allowed: false, reason: "Não foi possível determinar a Galáxia deste Planeta." };
  }

  const userGalaxyIds = await getUserGalaxyIds(user);
  if (!userGalaxyIds.includes(galaxyId)) {
    return { allowed: false, reason: "Você só pode criar/gerenciar Bridges em Galáxias às quais tem acesso." };
  }

  return { allowed: true };
}

// Regra de EDIÇÃO do conteúdo do Wireframe (blocos, anotações, comentários —
// toda rota de escrita em app/api/bridges/[id]/{wireframe-edit,annotations,
// comments}), separada de canAccessBridgeForPlanet (que só cobre acesso de
// LEITURA, por Galáxia). Depende da fase do Bridge:
// - AGUARDANDO_APROVACAO_WIREFRAME_PO: qualquer usuário com acesso à Galáxia
//   pode editar (mesmo comportamento de sempre, Wireframe-1a/1b/1c).
// - AGUARDANDO_APROVACAO_UX: só o uxUserId atribuído pode editar — o PO
//   (dono do Bridge) passa a ter só leitura nessa fase, a decisão agora é do
//   UX (Wireframe-2).
// - Qualquer outro status (gerando, erro, finalizado): ninguém edita.
// ADMIN sempre pode, em qualquer fase. Síncrona (sem acesso a banco) porque
// quem chama já tem o Bridge em mãos.
export function canEditWireframeContent(bridge: { status: string; uxUserId: string | null }, user: PermissionUser): boolean {
  if (user.permissionLevel === "ADMIN") return true;
  if (bridge.status === "AGUARDANDO_APROVACAO_WIREFRAME_PO") return true;
  if (bridge.status === "AGUARDANDO_APROVACAO_UX") return bridge.uxUserId === user.id;
  return false;
}
