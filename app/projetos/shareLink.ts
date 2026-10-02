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

export async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // Contextos sem Clipboard API: textarea temporário + execCommand.
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand("copy");
    } catch {
      // silencioso — melhor não copiar do que travar a ação
    }
    document.body.removeChild(textarea);
  }
}
