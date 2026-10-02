import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-helpers";
import { getAIProvider } from "@/lib/ai/provider";
import { canManageProject } from "@/lib/projects/permissions";
import { sectionsOrFallback } from "@/lib/projects/specSections";
import { parseAiJson } from "@/lib/projects/aiJson";

export const maxDuration = 60;

interface Params {
  params: { id: string };
}

// POST /api/projetos/:id/conflict-analysis -> Detector de Conflitos. Manda
// REGRAS DE NEGÓCIO + DEPENDÊNCIAS de TODOS os Bridge Specs do Projeto numa
// única chamada (cada trecho identificado pelo Bridge de origem) e pede à IA
// contradições/sobreposições reais. Substitui a análise anterior do Projeto.
export async function POST(_request: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const permission = await canManageProject({ projectId: params.id, user });
  if (!permission.allowed) return NextResponse.json({ error: permission.reason }, { status: 403 });

  const project = await db.project.findUnique({
    where: { id: params.id },
    select: {
      bridgeLinks: {
        select: { bridge: { select: { id: true, generatedBddPbi: true, planet: { select: { name: true } } } } },
      },
    },
  });
  if (!project) return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 });

  const withSpec = project.bridgeLinks.map((l) => l.bridge).filter((b) => !!b.generatedBddPbi);
  if (withSpec.length < 2) {
    return NextResponse.json(
      { error: "São necessários pelo menos 2 Bridges com Bridge Spec gerado para detectar conflitos." },
      { status: 400 }
    );
  }

  const blocks = withSpec
    .map(
      (b) =>
        `### BRIDGE id="${b.id}" nome="${b.planet.name}"\n${sectionsOrFallback(b.generatedBddPbi!, ["REGRAS DE NEGÓCIO", "DEPENDÊNCIAS"])}`
    )
    .join("\n\n");

  const prompt = `Você é um analista de produto procurando CONFLITOS REAIS entre os Bridge Specs de um mesmo Projeto. Abaixo estão as REGRAS DE NEGÓCIO e DEPENDÊNCIAS de cada Bridge, cada bloco identificado pelo id do Bridge.

${blocks}

Identifique apenas contradições (uma regra de um Bridge nega ou inviabiliza a de outro) ou sobreposições relevantes (dois Bridges definindo a mesma coisa de formas incompatíveis). Não invente conflitos nem liste diferenças inofensivas. Use SOMENTE os ids de Bridge fornecidos acima. Responda SOMENTE com JSON neste formato exato, sem texto antes ou depois (use lista vazia se não houver conflitos):
{"conflicts": [{"bridgeIdA": "id", "bridgeIdB": "id", "description": "descrição objetiva do conflito, em português"}]}`;

  let rawText: string;
  try {
    const provider = await getAIProvider();
    rawText = (await provider.generate({ prompt })).text;
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Falha ao consultar a IA." }, { status: 502 });
  }

  let conflicts: Array<{ bridgeIdA: string; bridgeIdB: string; description: string }>;
  try {
    const parsed = parseAiJson<{ conflicts?: unknown }>(rawText);
    const validIds = new Set(withSpec.map((b) => b.id));
    conflicts = (Array.isArray(parsed.conflicts) ? parsed.conflicts : [])
      .filter(
        (c): c is { bridgeIdA: string; bridgeIdB: string; description: string } =>
          !!c &&
          typeof c.bridgeIdA === "string" &&
          typeof c.bridgeIdB === "string" &&
          typeof c.description === "string" &&
          validIds.has(c.bridgeIdA) &&
          validIds.has(c.bridgeIdB) &&
          c.bridgeIdA !== c.bridgeIdB
      )
      .map((c) => ({ bridgeIdA: c.bridgeIdA, bridgeIdB: c.bridgeIdB, description: c.description.trim() }));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Resposta da IA inválida." }, { status: 502 });
  }

  await db.$transaction([
    db.projectConflictAnalysis.deleteMany({ where: { projectId: params.id } }),
    db.projectConflictAnalysis.create({ data: { projectId: params.id, conflicts } }),
  ]);

  return NextResponse.json({ conflictCount: conflicts.length });
}
