// Ações registradas em ActivityLog + textos legíveis (usado pela API e pela
// tela /atividades — sem imports de servidor, pode ir pro client).

export const ACTIVITY_ACTIONS = [
  "BRIDGE_CREATED",
  "BRIDGE_SPEC_APPROVED",
  "WIREFRAME_APPROVED_PO",
  "WIREFRAME_APPROVED_UX",
  "PROJECT_CREATED",
  "PROJECT_DELETED",
  "NOVA_NODE_CREATED",
  "NOVA_NODE_UPDATED",
  "NOVA_NODE_DELETED",
] as const;
export type ActivityAction = (typeof ACTIVITY_ACTIONS)[number];

export type ActivityEntityType = "BRIDGE" | "WIREFRAME" | "PROJECT" | "NOVA_NODE";

// Rótulo curto de cada ação (dropdown de filtro).
export const ACTIVITY_ACTION_FILTER_LABEL: Record<ActivityAction, string> = {
  BRIDGE_CREATED: "Bridge criado",
  BRIDGE_SPEC_APPROVED: "Bridge Spec (BS) aprovado",
  WIREFRAME_APPROVED_PO: "Wireframe aprovado (PO)",
  WIREFRAME_APPROVED_UX: "Wireframe aprovado e exportado (UX)",
  PROJECT_CREATED: "Projeto criado",
  PROJECT_DELETED: "Projeto excluído",
  NOVA_NODE_CREATED: "NOVA — item criado",
  NOVA_NODE_UPDATED: "NOVA — item editado",
  NOVA_NODE_DELETED: "NOVA — item excluído",
};

// Tipo do nó da NOVA -> artigo + nome ("uma Galáxia" / "a Galáxia").
const NODE_TYPE: Record<string, { name: string; feminine: boolean }> = {
  UNIVERSO: { name: "Universo", feminine: false },
  GALAXIA: { name: "Galáxia", feminine: true },
  ESTRELA: { name: "Estrela", feminine: true },
  PLANETA: { name: "Planeta", feminine: false },
};

// Frase da ação, lida depois do nome do usuário: "Fulano {frase}".
export function describeActivity(action: string, metadata: unknown): string {
  const nodeType = (metadata as { nodeType?: string } | null)?.nodeType ?? "";
  const node = NODE_TYPE[nodeType];
  switch (action) {
    case "BRIDGE_CREATED":
      return "criou um Bridge";
    case "BRIDGE_SPEC_APPROVED":
      return "aprovou o Bridge Spec (BS)";
    case "WIREFRAME_APPROVED_PO":
      return "aprovou o Wireframe (PO)";
    case "WIREFRAME_APPROVED_UX":
      return "aprovou e exportou o Wireframe (UX)";
    case "PROJECT_CREATED":
      return "criou um Projeto";
    case "PROJECT_DELETED":
      return "excluiu um Projeto";
    case "NOVA_NODE_CREATED":
      return node ? `criou ${node.feminine ? "uma" : "um"} ${node.name}` : "criou um item na NOVA";
    case "NOVA_NODE_UPDATED":
      return node ? `editou ${node.feminine ? "a" : "o"} ${node.name}` : "editou um item na NOVA";
    case "NOVA_NODE_DELETED":
      return node ? `excluiu ${node.feminine ? "a" : "o"} ${node.name}` : "excluiu um item na NOVA";
    default:
      return action;
  }
}
