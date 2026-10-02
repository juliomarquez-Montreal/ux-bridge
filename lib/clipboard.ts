// Copia texto para a área de transferência (com fallback para contextos sem
// Clipboard API) — usado pelos ícones de "Compartilhar" (Projetos, Wireframes).
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
