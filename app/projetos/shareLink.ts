// Link permanente de compartilhar um Projeto (somente leitura, qualquer
// usuário autenticado) — mesmo padrão do link de Bridge em /bridges.
export function projectShareUrl(projectId: string): string {
  return `${window.location.origin}/projetos/${projectId}/share`;
}

export function projectMailtoHref(projectName: string, projectId: string): string {
  const subject = encodeURIComponent(`UX Bridge — Projeto ${projectName}`);
  const body = encodeURIComponent(projectShareUrl(projectId));
  return `mailto:?subject=${subject}&body=${body}`;
}

export { copyText } from "@/lib/clipboard";
