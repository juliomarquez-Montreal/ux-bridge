import { extractSections } from "./specSections";

export type SpecPriority = "ALTA" | "MEDIA" | "BAIXA";

// A IA é instruída a sugerir "Alta, Média ou Baixa" na seção PRIORIDADE /
// RELEASE do Bridge Spec (ver BRIDGE_SPEC_STRUCTURE_INSTRUCTION em
// lib/bridges/generate.ts). Pega a PRIMEIRA dessas palavras que aparece na
// seção; devolve null se o Bridge não tem Spec, a seção não existe (Spec em
// formato antigo) ou ela não menciona nenhuma — nunca chuta.
export function extractPriority(spec: string | null): SpecPriority | null {
  if (!spec) return null;
  const section = extractSections(spec)["PRIORIDADE / RELEASE"];
  if (!section) return null;
  const match = section.match(/\b(alta|m[eé]dia|baixa)\b/i);
  if (!match) return null;
  const word = match[1].toLowerCase();
  if (word === "alta") return "ALTA";
  if (word === "baixa") return "BAIXA";
  return "MEDIA";
}
