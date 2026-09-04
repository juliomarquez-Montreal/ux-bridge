import type { ApiContextNode } from "./types";

// Filtra a árvore por nome (case-insensitive, substring). Se o próprio nó
// combina, mantém a subárvore original inteira (o usuário já achou o que
// queria, os filhos naturais dele continuam relevantes). Se não combina mas
// algum descendente combina, mantém só os ramos que levam até lá.
export function filterTreeBySearch(nodes: ApiContextNode[], query: string): ApiContextNode[] {
  const q = query.trim().toLowerCase();
  if (!q) return nodes;

  function filterNode(node: ApiContextNode): ApiContextNode | null {
    if (node.name.toLowerCase().includes(q)) return node;

    const filteredChildren = node.children.map(filterNode).filter((n): n is ApiContextNode => n !== null);
    if (filteredChildren.length === 0) return null;
    return { ...node, children: filteredChildren };
  }

  return nodes.map(filterNode).filter((n): n is ApiContextNode => n !== null);
}

// Todos os ids de uma árvore (usado pra forçar expansão de tudo enquanto uma
// busca está ativa, senão um resultado a 3 níveis de profundidade fica
// escondido atrás de nós recolhidos).
export function collectAllIds(nodes: ApiContextNode[]): Set<string> {
  const ids = new Set<string>();
  function walk(list: ApiContextNode[]) {
    for (const node of list) {
      ids.add(node.id);
      walk(node.children);
    }
  }
  walk(nodes);
  return ids;
}
