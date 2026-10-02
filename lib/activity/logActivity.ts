import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getGalaxyAncestorId } from "@/lib/nova/permissions";
import type { ActivityAction, ActivityEntityType } from "./actions";

interface LogActivityInput {
  userId: string;
  action: ActivityAction;
  entityType: ActivityEntityType;
  entityId: string;
  // Nome legível do item NO MOMENTO da ação (sobrevive à exclusão do item).
  entityLabel: string;
  metadata?: Prisma.InputJsonValue;
  // Nó da árvore NOVA (Planeta/Estrela/Galáxia) usado pra descobrir a Galáxia
  // do item, que decide quem enxerga o registro em /atividades. Omitir =
  // visível a qualquer usuário autenticado (Projetos, Universo).
  galaxyFromNodeId?: string | null;
  // Galáxia já conhecida (ex: o próprio nó é a Galáxia, inclusive excluída).
  galaxyId?: string | null;
}

// Grava uma linha em ActivityLog. NUNCA lança: o histórico é secundário e uma
// falha aqui não pode derrubar a ação principal (criar/aprovar/excluir).
export async function logActivity(input: LogActivityInput): Promise<void> {
  try {
    const galaxyId = input.galaxyId ?? (input.galaxyFromNodeId ? await getGalaxyAncestorId(input.galaxyFromNodeId) : null);
    await db.activityLog.create({
      data: {
        userId: input.userId,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        entityLabel: input.entityLabel,
        metadata: input.metadata,
        galaxyId,
      },
    });
  } catch (error) {
    console.error("Falha ao registrar atividade:", error);
  }
}
