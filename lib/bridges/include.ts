import type { Prisma } from "@prisma/client";

// Include padrão pra resolver Planeta/Estrela/Galáxia + PO/UX (Wireframe-1a)
// de um Bridge — usado em toda rota que devolve um Bridge pro client (GET,
// approve, reject, retry, wireframe-edit, assign-ux), pra nunca devolver um
// formato incompleto que quebre a UI.
export const BRIDGE_WITH_PLANET_INCLUDE = {
  planet: {
    select: {
      id: true,
      name: true,
      parent: { select: { id: true, name: true, parent: { select: { id: true, name: true } } } },
    },
  },
  poUser: { select: { id: true, name: true, avatarUrl: true } },
  uxUser: { select: { id: true, name: true, avatarUrl: true } },
} satisfies Prisma.BridgeInclude;
