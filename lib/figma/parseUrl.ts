export class FigmaUrlError extends Error {}

// Extrai o file key de um link colado do Figma. Aceita os dois formatos de
// URL que o Figma usa hoje: .../file/{key}/... (arquivos antigos) e
// .../design/{key}/... (arquivos novos) — o key é sempre o segmento logo
// depois de "file" ou "design" no path.
export function parseFigmaFileKey(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    throw new FigmaUrlError("Cole o link do arquivo do Figma.");
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new FigmaUrlError("Isso não parece uma URL válida. Cole o link completo do arquivo do Figma.");
  }

  if (!/(^|\.)figma\.com$/i.test(parsed.hostname)) {
    throw new FigmaUrlError("O link precisa ser de um arquivo do Figma (figma.com).");
  }

  const match = parsed.pathname.match(/\/(file|design)\/([a-zA-Z0-9]+)/);
  if (!match) {
    throw new FigmaUrlError(
      "Não foi possível encontrar o file key nesse link. Use o link direto do arquivo (com /file/ ou /design/ na URL)."
    );
  }

  return match[2];
}
