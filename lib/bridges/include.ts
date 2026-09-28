import type { Prisma } from "@prisma/client";

// Include padrão pra resolver Planeta/Estrela/Galáxia de um Bridge — usado
// em toda rota que devolve um Bridge pro client (GET, approve, reject,
// retry), pra nunca devolver um formato incompleto que quebre a UI.
export const BRIDGE_WITH_PLANET_INCLUDE = {
  planet: {
    select: {
      id: true,
      name: true,
      parent: { select: { id: true, name: true, parent: { select: { id: true, name: true } } } },
    },
  },
} satisfies Prisma.BridgeInclude;
