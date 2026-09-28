export type BridgeStatus = "GERANDO_BDD" | "AGUARDANDO_APROVACAO_PO" | "AGUARDANDO_WIREFRAME" | "ERRO_GERACAO";

export interface ApiBridgeListItem {
  id: string;
  status: BridgeStatus;
  createdAt: string;
  attemptCount: number;
  planeta: { id: string; name: string };
  estrela: { id: string; name: string } | null;
  galaxia: { id: string; name: string } | null;
}

export interface ApiBridge {
  id: string;
  planetContextNodeId: string;
  createdById: string;
  status: BridgeStatus;
  rawMaterialText: string | null;
  rawMaterialFileUrl: string | null;
  generatedBddPbi: string | null;
  errorMessage: string | null;
  attemptCount: number;
  lastRejectionComment: string | null;
  createdAt: string;
  updatedAt: string;
  planet: {
    id: string;
    name: string;
    parent: { id: string; name: string; parent: { id: string; name: string } | null } | null;
  };
}
