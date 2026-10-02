import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-helpers";
import { getAIProvider } from "@/lib/ai/provider";
import { canManageProject } from "@/lib/projects/permissions";
import { sectionsOrFallback } from "@/lib/projects/specSections";
import { parseAiJson } from "@/lib/projects/aiJson";

// Uma chamada de IA por Bridge, em paralelo — pode levar um tempo.
export const maxDuration = 60;

interface Params {
  params: { id: string };
}

// POST /api/projetos/:id/scope-analysis -> Radar de Desvio de Escopo. Pra
// CADA Bridge vinculado que já tem Bridge Spec gerado, pergunta à IA se ele
// contribui pro `objective` do Projeto, olhando só CONTEXTO / PROBLEMA e
// HISTÓRIA DE USUÁRIO. Sobrescreve a análise anterior de cada Bridge.
export async function POST(_request: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const permission = await canManageProject({ projectId: params.id, user });
  if (!permission.allowed) return NextResponse.json({ error: permission.reason }, { status: 403 });

  const project = await db.project.findUnique({
    where: { id: params.id },
    select: {
      objective: true,
      bridgeLinks: {
        select: { bridge: { select: { id: true, generatedBddPbi: true, planet: { select: { name: true } } } } },
      },
    },
  });
  if (!project) return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 });

  const objective = project.objective?.trim();
  if (!objective) {
    return NextResponse.json(
      { error: "Preencha o objetivo do Projeto (card \"Objetivo do projeto\" na Visão geral) antes de analisar o alinhamento." },
      { status: 400 }
    );
  }

  const withSpec = project.bridgeLinks.map((l) => l.bridge).filter((b) => !!b.generatedBddPbi);
  if (withSpec.length === 0) {
    return NextResponse.json({ error: "Nenhum Bridge vinculado tem Bridge Spec gerado ainda." }, { status: 400 });
  }

  let provider;
  try {
    provider = await getAIProvider();
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "IA indisponível." }, { status: 502 });
  }

  const results = await Promise.all(
    withSpec.map(async (bridge) => {
      const excerpt = sectionsOrFallback(bridge.generatedBddPbi!, ["CONTEXTO / PROBLEMA", "HISTÓRIA DE USUÁRIO"]);
      const prompt = `Você é um analista de produto avaliando se um Bridge contribui para o objetivo de um Projeto.

OBJETIVO DO PROJETO:
"""
${objective}
"""

BRIDGE "${bridge.planet.name}" (trechos do Bridge Spec):
"""
${excerpt}
"""

Seja criterioso: marque aligned=false quando o assunto do Bridge NÃO ajuda a atingir o objetivo do Projeto (ex: tema diferente, funcionalidade sem relação). Responda SOMENTE com JSON neste formato exato, sem texto antes ou depois:
{"aligned": true|false, "explanation": "1 a 2 frases em português justificando"}`;
      try {
        const { text } = await provider.generate({ prompt });
        const parsed = parseAiJson<{ aligned?: unknown; explanation?: unknown }>(text);
        if (typeof parsed.aligned !== "boolean" || typeof parsed.explanation !== "string") {
          throw new Error("Resposta da IA fora do formato esperado.");
        }
        return { bridgeId: bridge.id, aligned: parsed.aligned, explanation: parsed.explanation.trim() };
      } catch (error) {
        return { bridgeId: bridge.id, error: error instanceof Error ? error.message : "Falha na análise." };
      }
    })
  );

  const ok = results.filter((r): r is { bridgeId: string; aligned: boolean; explanation: string } => !("error" in r));
  const failed = results.filter((r): r is { bridgeId: string; error: string } => "error" in r);

  await db.$transaction([
    db.projectScopeAnalysis.deleteMany({ where: { projectId: params.id, bridgeId: { in: ok.map((r) => r.bridgeId) } } }),
    db.projectScopeAnalysis.createMany({
      data: ok.map((r) => ({ projectId: params.id, bridgeId: r.bridgeId, aligned: r.aligned, explanation: r.explanation })),
    }),
  ]);

  return NextResponse.json({
    analyzed: ok.length,
    skippedWithoutSpec: project.bridgeLinks.length - withSpec.length,
    failed,
  });
}
