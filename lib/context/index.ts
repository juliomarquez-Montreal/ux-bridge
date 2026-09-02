import type { ContextNode } from "@prisma/client";
import { db } from "@/lib/db";

// Tipos de nó suportados pelo Context Graph, na ordem em que compõem a hierarquia.
export type ContextNodeType = "SQUAD" | "DOMAIN" | "ARTIFACT" | "INTENT";

export interface ResolveContextInput {
  squadId: string;
  domain: string;
  artifactType: string;
  intent: string;
}

async function getOrCreateNode(
  type: ContextNodeType,
  name: string,
  parentId: string | null
): Promise<ContextNode> {
  const existing = await db.contextNode.findFirst({ where: { type, name, parentId } });
  if (existing) return existing;

  return db.contextNode.create({ data: { type, name, parentId } });
}

// Resolve (ou cria) a cadeia SQUAD -> DOMAIN -> ARTIFACT -> INTENT e retorna o nó folha (INTENT),
// que é o nível mais específico ao qual os MemoryPattern são vinculados.
export async function resolveContextNode(input: ResolveContextInput): Promise<ContextNode> {
  const squadNode = await getOrCreateNode("SQUAD", input.squadId, null);
  const domainNode = await getOrCreateNode("DOMAIN", input.domain, squadNode.id);
  const artifactNode = await getOrCreateNode("ARTIFACT", input.artifactType, domainNode.id);
  const intentNode = await getOrCreateNode("INTENT", input.intent, artifactNode.id);

  return intentNode;
}

// Navega a hierarquia subindo por parentId, do nó informado até a raiz.
// Retorna do mais específico para o mais genérico (ex: [INTENT, ARTIFACT, DOMAIN, SQUAD]).
export async function getAncestors(contextNodeId: string): Promise<ContextNode[]> {
  const ancestors: ContextNode[] = [];
  let currentId: string | null = contextNodeId;

  while (currentId) {
    const node: ContextNode | null = await db.contextNode.findUnique({ where: { id: currentId } });
    if (!node) break;
    ancestors.push(node);
    currentId = node.parentId;
  }

  return ancestors;
}

// Lista os filhos diretos de um nó (ex: os domínios de um squad, ou os artefatos de um domínio).
export async function getChildren(contextNodeId: string): Promise<ContextNode[]> {
  return db.contextNode.findMany({ where: { parentId: contextNodeId } });
}

// Caminho de contexto completo (raiz -> folha), pronto para exibição ou para localizar
// quais níveis de memória consultar. Ex: "Squad Alpha > Checkout > BDD > Redefinir senha".
export async function getContextPath(contextNodeId: string): Promise<ContextNode[]> {
  const ancestors = await getAncestors(contextNodeId);
  return ancestors.reverse();
}

export function formatContextPath(path: ContextNode[]): string {
  return path.map((node) => node.name).join(" > ");
}
