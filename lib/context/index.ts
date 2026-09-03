import type { ContextNode, ContextNodeType } from "@prisma/client";
import { db } from "@/lib/db";

// Hierarquia da NOVA: Universo (organização/cliente) > Galáxia (squad/área)
// > Estrela (categoria de trabalho) > Planeta (tarefa/artefato específico).
export interface ResolveContextInput {
  universo: string;
  galaxia: string;
  estrela: string;
  planeta: string;
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

// Resolve (ou cria) a cadeia UNIVERSO -> GALAXIA -> ESTRELA -> PLANETA e
// retorna o nó folha (PLANETA), que é o nível mais específico ao qual os
// MemoryPattern são vinculados.
export async function resolveContextNode(input: ResolveContextInput): Promise<ContextNode> {
  const universoNode = await getOrCreateNode("UNIVERSO", input.universo, null);
  const galaxiaNode = await getOrCreateNode("GALAXIA", input.galaxia, universoNode.id);
  const estrelaNode = await getOrCreateNode("ESTRELA", input.estrela, galaxiaNode.id);
  const planetaNode = await getOrCreateNode("PLANETA", input.planeta, estrelaNode.id);

  return planetaNode;
}

// Navega a hierarquia subindo por parentId, do nó informado até a raiz.
// Retorna do mais específico para o mais genérico (ex: [PLANETA, ESTRELA, GALAXIA, UNIVERSO]).
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

// Lista os filhos diretos de um nó (ex: as galáxias de um universo, ou as estrelas de uma galáxia).
export async function getChildren(contextNodeId: string): Promise<ContextNode[]> {
  return db.contextNode.findMany({ where: { parentId: contextNodeId } });
}

// Caminho de contexto completo (raiz -> folha), pronto para exibição ou para localizar
// quais níveis de memória consultar. Ex: "Governo de Minas Gerais > ARTEMIG-Concessões > Contratos > Listagem de Contratos".
export async function getContextPath(contextNodeId: string): Promise<ContextNode[]> {
  const ancestors = await getAncestors(contextNodeId);
  return ancestors.reverse();
}

export function formatContextPath(path: ContextNode[]): string {
  return path.map((node) => node.name).join(" > ");
}
