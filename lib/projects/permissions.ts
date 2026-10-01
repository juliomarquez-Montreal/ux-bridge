import { db } from "@/lib/db";
import type { PermissionUser } from "@/lib/nova/permissions";

export interface PermissionResult {
  allowed: boolean;
  reason?: string;
}

// Regra de gerenciamento de um Projeto (vincular/desvincular Bridge, editar
// objetivo, adicionar/remover membro ou sprint, excluir o Projeto): ADMIN em
// qualquer Projeto, ou quem já é equipe dele (criador ou ProjectMember,
// PO ou UX). Ver (Projeto-1) — Project não é escopado por Galáxia (pode
// agrupar Bridges de Galáxias diferentes), então o controle de acesso é por
// equipe do próprio Projeto, não por Galáxia.
export async function canManageProject(input: { projectId: string; user: PermissionUser }): Promise<PermissionResult> {
  const { projectId, user } = input;

  if (user.permissionLevel === "ADMIN") return { allowed: true };

  const project = await db.project.findUnique({ where: { id: projectId }, select: { createdById: true } });
  if (!project) return { allowed: false, reason: "Projeto não encontrado." };
  if (project.createdById === user.id) return { allowed: true };

  const membership = await db.projectMember.findFirst({ where: { projectId, userId: user.id } });
  if (membership) return { allowed: true };

  return { allowed: false, reason: "Você precisa ser da equipe deste Projeto para gerenciá-lo." };
}
