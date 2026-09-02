import type { ApprovalDecision, MemoryPattern, Prisma } from "@prisma/client";
import { db } from "@/lib/db";

export interface RecordPatternInput {
  contextNodeId: string;
  patternType: string;
  patternData: Prisma.InputJsonValue;
  sourceApprovalId?: string;
  initialConfidence?: number;
}

// Registra um novo MemoryPattern a partir de um artefato aprovado, vinculado ao
// contexto onde ele se aplica e (quando existir) ao ApprovalLog que o originou.
export async function recordApprovedPattern(input: RecordPatternInput): Promise<MemoryPattern> {
  return db.memoryPattern.create({
    data: {
      contextNodeId: input.contextNodeId,
      patternType: input.patternType,
      patternData: input.patternData,
      confidence: input.initialConfidence ?? 0.5,
      sourceApprovalId: input.sourceApprovalId,
    },
  });
}

export interface RelevantPatternsOptions {
  patternType?: string;
  limit?: number;
}

// Consulta os padrões de memória de um contexto, do mais confiável para o menos confiável.
export async function getRelevantPatterns(
  contextNodeId: string,
  options: RelevantPatternsOptions = {}
): Promise<MemoryPattern[]> {
  return db.memoryPattern.findMany({
    where: {
      contextNodeId,
      ...(options.patternType ? { patternType: options.patternType } : {}),
    },
    orderBy: { confidence: "desc" },
    take: options.limit ?? 20,
  });
}

const CONFIDENCE_MIN = 0.05;
const CONFIDENCE_MAX = 0.99;

function clampConfidence(value: number): number {
  return Math.min(CONFIDENCE_MAX, Math.max(CONFIDENCE_MIN, value));
}

// Ajusta a confidence de um padrão com base numa nova decisão de aprovação:
// - APPROVE reforça o padrão (aproxima de 1, com retorno decrescente)
// - CORRECT reduz moderadamente (o padrão precisou de ajuste manual)
// - REJECT reduz fortemente (o padrão não se aplicava a esse contexto)
export async function adjustPatternConfidence(
  patternId: string,
  decision: ApprovalDecision
): Promise<MemoryPattern> {
  const pattern = await db.memoryPattern.findUniqueOrThrow({ where: { id: patternId } });

  let nextConfidence = pattern.confidence;
  if (decision === "APPROVE") {
    nextConfidence = pattern.confidence + (1 - pattern.confidence) * 0.2;
  } else if (decision === "CORRECT") {
    nextConfidence = pattern.confidence - pattern.confidence * 0.3;
  } else if (decision === "REJECT") {
    nextConfidence = pattern.confidence * 0.5;
  }

  return db.memoryPattern.update({
    where: { id: patternId },
    data: { confidence: clampConfidence(nextConfidence) },
  });
}
