// Extrai o primeiro objeto/array JSON de uma resposta da IA, tolerando cercas
// de markdown (```json ... ```) e texto solto antes/depois. Lança erro se não
// houver JSON válido.
export function parseAiJson<T>(raw: string): T {
  const stripped = raw.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  const firstBrace = stripped.search(/[{[]/);
  if (firstBrace === -1) throw new Error("A IA não retornou um JSON válido.");
  const closing = stripped[firstBrace] === "{" ? "}" : "]";
  const lastClose = stripped.lastIndexOf(closing);
  if (lastClose === -1) throw new Error("A IA não retornou um JSON válido.");
  try {
    return JSON.parse(stripped.slice(firstBrace, lastClose + 1)) as T;
  } catch {
    throw new Error("A IA retornou um JSON inválido.");
  }
}
