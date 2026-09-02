import { NextResponse } from "next/server";
import { formatContextPath, getContextPath, resolveContextNode } from "@/lib/context";
import { adjustPatternConfidence, getRelevantPatterns, recordApprovedPattern } from "@/lib/memory";
import { getAIProvider } from "@/lib/ai/provider";

// Rota de teste manual (apenas dev): resolve um contexto fake, registra padrões de
// memória, ajusta confidence, confirma que a consulta por contexto os recupera, e
// chama o provider de IA ativo (getAIProvider) passando esse contexto + memória.
export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Rota disponível apenas em desenvolvimento." }, { status: 404 });
  }

  try {
    const contextNode = await resolveContextNode({
      squadId: "squad-teste",
      domain: "Checkout",
      artifactType: "BDD",
      intent: "Redefinir senha",
    });

    const contextPath = await getContextPath(contextNode.id);

    const patternA = await recordApprovedPattern({
      contextNodeId: contextNode.id,
      patternType: "BDD_STRUCTURE",
      patternData: {
        given: "usuário na tela de login",
        when: "clica em 'esqueci minha senha'",
        then: "recebe email de redefinição",
      },
      sourceApprovalId: "approval-teste-1",
    });

    const patternB = await recordApprovedPattern({
      contextNodeId: contextNode.id,
      patternType: "BDD_STRUCTURE",
      patternData: {
        given: "usuário autenticado",
        when: "solicita troca de senha",
        then: "exige confirmação da senha atual",
      },
      sourceApprovalId: "approval-teste-2",
      initialConfidence: 0.4,
    });

    // Padrão A recebe reforço (nova aprovação); padrão B recebe uma correção.
    const patternAAfterApprove = await adjustPatternConfidence(patternA.id, "APPROVE");
    const patternBAfterCorrect = await adjustPatternConfidence(patternB.id, "CORRECT");

    const relevantPatterns = await getRelevantPatterns(contextNode.id, {
      patternType: "BDD_STRUCTURE",
    });

    const provider = await getAIProvider();
    const aiResult = await provider.generate({
      prompt: "Resuma em uma frase os padrões de BDD conhecidos para este contexto.",
      context: formatContextPath(contextPath),
      memoryPatterns: relevantPatterns,
    });

    return NextResponse.json({
      ok: true,
      contextNode,
      contextPath: formatContextPath(contextPath),
      contextPathNodes: contextPath,
      patterns: {
        registeredIds: [patternA.id, patternB.id],
        afterAdjustment: { patternA: patternAAfterApprove, patternB: patternBAfterCorrect },
        relevantOrderedByConfidence: relevantPatterns,
      },
      ai: { providerUsed: provider.name, text: aiResult.text },
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Erro desconhecido" },
      { status: 500 }
    );
  }
}
