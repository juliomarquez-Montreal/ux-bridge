// O Bridge Spec gerado (Bridge.generatedBddPbi) tem 10 seções com títulos em
// maiúsculas em linhas próprias (ver BRIDGE_SPEC_STRUCTURE_INSTRUCTION em
// lib/bridges/generate.ts). Aqui extraímos seções específicas pra mandar só o
// trecho relevante à IA (Radar de Escopo / Detector de Conflitos).
const HEADINGS = [
  "TÍTULO",
  "CONTEXTO / PROBLEMA",
  "HISTÓRIA DE USUÁRIO",
  "CRITÉRIOS DE ACEITE",
  "CENÁRIOS BDD",
  "REGRAS DE NEGÓCIO",
  "DEPENDÊNCIAS",
  "REQUISITOS NÃO FUNCIONAIS",
  "PRIORIDADE / RELEASE",
  "DEFINITION OF READY",
] as const;
export type SpecHeading = (typeof HEADINGS)[number];

// Tolera markdown em volta do título ("## REGRAS DE NEGÓCIO", "**...**", "1. ...", ":" no fim).
function normalizeHeading(line: string): string {
  return line
    .trim()
    .replace(/^[#*_\s\d.)-]+/, "")
    .replace(/[*_:\s]+$/, "")
    .toUpperCase();
}

export function extractSections(spec: string): Partial<Record<SpecHeading, string>> {
  const result: Partial<Record<SpecHeading, string>> = {};
  let current: SpecHeading | null = null;
  const buffer: string[] = [];

  const flush = () => {
    if (current) result[current] = buffer.join("\n").trim();
    buffer.length = 0;
  };

  for (const line of spec.split("\n")) {
    const normalized = normalizeHeading(line);
    const match = HEADINGS.find((h) => h === normalized);
    if (match) {
      flush();
      current = match;
    } else if (current) {
      buffer.push(line);
    }
  }
  flush();
  return result;
}

// Seções pedidas, ou o Spec inteiro (truncado) quando o formato antigo não
// tem os títulos — assim a análise ainda funciona em Bridges legados.
export function sectionsOrFallback(spec: string, wanted: SpecHeading[], maxFallbackChars = 4000): string {
  const sections = extractSections(spec);
  const parts = wanted
    .map((heading) => (sections[heading] ? `${heading}:\n${sections[heading]}` : null))
    .filter((p): p is string => p !== null);
  if (parts.length > 0) return parts.join("\n\n");
  return spec.slice(0, maxFallbackChars);
}
