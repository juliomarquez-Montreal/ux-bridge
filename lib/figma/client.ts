const FIGMA_API_BASE = "https://api.figma.com/v1";

export interface FigmaComponent {
  key: string;
  nodeId: string;
  name: string;
  description: string;
  thumbnailUrl: string | null;
}

// Erro "de negócio" (token inválido, arquivo não encontrado, etc.) — sempre
// tem uma mensagem clara em português pronta pra devolver na resposta HTTP.
export class FigmaApiError extends Error {}

// Token único da conta Montreal, compartilhado por todas as fontes/Galáxias
// (cada fonte já carrega o próprio file key, extraído da URL colada).
function getFigmaToken(): string {
  const token = process.env.FIGMA_ACCESS_TOKEN;
  if (!token) throw new FigmaApiError("FIGMA_ACCESS_TOKEN não configurado no ambiente.");
  return token;
}

async function figmaFetch(path: string, token: string): Promise<unknown> {
  let res: Response;
  try {
    res = await fetch(`${FIGMA_API_BASE}${path}`, { headers: { "X-Figma-Token": token } });
  } catch {
    throw new FigmaApiError("Não foi possível conectar à API do Figma. Tente novamente.");
  }

  if (res.status === 401 || res.status === 403) {
    throw new FigmaApiError("Token de acesso do Figma inválido, expirado ou sem permissão para este arquivo.");
  }
  if (res.status === 404) {
    throw new FigmaApiError("Arquivo do Figma não encontrado (verifique o FIGMA_FILE_KEY).");
  }
  if (res.status === 429) {
    throw new FigmaApiError("Limite de requisições da API do Figma atingido. Tente novamente em alguns minutos.");
  }
  if (!res.ok) {
    throw new FigmaApiError(`Erro ao consultar a API do Figma (status ${res.status}).`);
  }
  return res.json();
}

interface FigmaComponentsResponse {
  meta?: {
    components?: Array<{
      key: string;
      node_id: string;
      name: string;
      description?: string;
      thumbnail_url?: string | null;
    }>;
  };
}

interface FigmaImagesResponse {
  images?: Record<string, string | null>;
}

// Busca todos os componentes publicados de um arquivo do Figma (por
// file key). O endpoint /files/:key/components já filtra só componentes
// de verdade (não qualquer node) e devolve thumbnail_url pronto pra maioria
// deles; pro raro caso de vir sem thumbnail, completa em lote via /images.
export async function fetchFigmaComponents(fileKey: string): Promise<FigmaComponent[]> {
  const token = getFigmaToken();

  const data = (await figmaFetch(`/files/${fileKey}/components`, token)) as FigmaComponentsResponse;
  const raw = data.meta?.components ?? [];

  let components: FigmaComponent[] = raw.map((c) => ({
    key: c.key,
    nodeId: c.node_id,
    name: c.name,
    description: c.description ?? "",
    thumbnailUrl: c.thumbnail_url ?? null,
  }));

  const missingThumbnail = components.filter((c) => !c.thumbnailUrl);
  if (missingThumbnail.length > 0) {
    const ids = missingThumbnail.map((c) => c.nodeId).join(",");
    const imagesData = (await figmaFetch(
      `/images/${fileKey}?ids=${encodeURIComponent(ids)}&format=png`,
      token
    )) as FigmaImagesResponse;
    const images = imagesData.images ?? {};
    components = components.map((c) => (c.thumbnailUrl ? c : { ...c, thumbnailUrl: images[c.nodeId] ?? null }));
  }

  return components;
}
