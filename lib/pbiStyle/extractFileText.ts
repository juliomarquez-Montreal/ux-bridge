// Extrai o texto bruto de um PBI de exemplo enviado (.pdf/.docx/.md), antes
// de pedir pra IA isolar só o Acceptance Criteria (ver extractAcceptanceCriteria.ts).
// Esse texto bruto ainda tem todo o ruído do arquivo real (ID da tarefa,
// story points, commits etc.) — só a extração de Gherkin na etapa seguinte
// filtra isso.
import mammoth from "mammoth";
// Importa o módulo interno direto, não o pacote "pdf-parse" raiz: o index.js
// do pacote detecta "modo debug" via `!module.parent` e, empacotado pelo
// webpack (Next.js build), module.parent nunca existe — ele tenta ler um PDF
// de teste do próprio pacote e quebra o build. Pulando o index.js evita isso.
import pdfParse from "pdf-parse/lib/pdf-parse.js";

export type PbiStyleExtension = "pdf" | "docx" | "md";

export const ALLOWED_PBI_STYLE_EXTENSIONS: PbiStyleExtension[] = ["pdf", "docx", "md"];

export function pbiStyleExtensionOf(filename: string): string {
  return filename.split(".").pop()?.toLowerCase() ?? "";
}

export async function extractFileText(file: File): Promise<string> {
  const extension = pbiStyleExtensionOf(file.name);
  const buffer = Buffer.from(await file.arrayBuffer());

  if (extension === "md") {
    return buffer.toString("utf-8");
  }
  if (extension === "pdf") {
    const result = await pdfParse(buffer);
    return result.text;
  }
  if (extension === "docx") {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  throw new Error(`Extensão .${extension || "?"} não suportada. Use: .pdf, .docx ou .md.`);
}
