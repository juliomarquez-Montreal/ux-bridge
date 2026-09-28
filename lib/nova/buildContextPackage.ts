import type { MemoryPattern, PlanetExample } from "@prisma/client";
import { getContextPath } from "@/lib/context";
import { db } from "@/lib/db";
import { getRelevantPatterns } from "@/lib/memory";

export const EXAMPLE_KINDS = ["RAW_TRANSCRIPT", "FINAL_BDD_PBI", "WIREFRAME_REFERENCE"] as const;
export type PlanetExampleKind = (typeof EXAMPLE_KINDS)[number];
export type DesignSystemStatus = "LINKED" | "NONE_LINKED";

type Position = { id: string; name: string };
type ExampleWithOrigin = PlanetExample & { origin: { planet: Position; galaxy: Position } };

export interface ContextPackage {
  position: { universo: Position; galaxia: Position; estrela: Position; planeta: Position };
  memoryPatterns: MemoryPattern[];
  trainingExamples: Record<PlanetExampleKind, ExampleWithOrigin[]>;
  designSystemStatus: DesignSystemStatus;
  designSystemComponents: Array<{
    id: string;
    name: string;
    figmaComponentKey: string | null;
    thumbnailUrl: string | null;
    description: string | null;
    metadata: unknown;
    source: { id: string; name: string };
  }>;
}

// Monta o contexto completo que uma geração de BDD/PBI ou wireframe recebe.
// O escopo de memória é o próprio Planeta; exemplos são compartilhados por tipo.
export async function buildContextPackage(planetContextNodeId: string): Promise<ContextPackage> {
  const planet = await db.contextNode.findUnique({
    where: { id: planetContextNodeId },
    select: { id: true, name: true, type: true, planetTypeId: true },
  });

  if (!planet) throw new Error("Planeta de contexto não encontrado.");
  if (planet.type !== "PLANETA") throw new Error("buildContextPackage só aceita um nó do tipo PLANETA.");
  if (!planet.planetTypeId) throw new Error("O Planeta informado não possui um Tipo de Planeta.");

  const path = await getContextPath(planet.id);
  const byType = new Map(path.map((node) => [node.type, node]));
  const universo = byType.get("UNIVERSO");
  const galaxia = byType.get("GALAXIA");
  const estrela = byType.get("ESTRELA");

  if (!universo || !galaxia || !estrela) throw new Error("A árvore do Planeta está incompleta: esperado Universo > Galáxia > Estrela > Planeta.");

  const [memoryPatterns, examples, galaxyLinks] = await Promise.all([
    getRelevantPatterns(planet.id),
    db.planetExample.findMany({
      where: { contextNode: { type: "PLANETA", planetTypeId: planet.planetTypeId } },
      orderBy: { createdAt: "asc" },
      include: {
        contextNode: {
          select: {
            id: true,
            name: true,
            parent: { select: { parent: { select: { id: true, name: true, type: true } } } },
          },
        },
      },
    }),
    db.designSystemGalaxyLink.findMany({
      where: { galaxyId: galaxia.id },
      include: { source: { include: { components: { orderBy: { name: "asc" } } } } },
    }),
  ]);

  const trainingExamples: Record<PlanetExampleKind, ExampleWithOrigin[]> = { RAW_TRANSCRIPT: [], FINAL_BDD_PBI: [], WIREFRAME_REFERENCE: [] };
  for (const example of examples) {
    if (!EXAMPLE_KINDS.includes(example.kind as PlanetExampleKind)) continue;
    const exampleGalaxy = example.contextNode.parent?.parent;
    if (!exampleGalaxy || exampleGalaxy.type !== "GALAXIA") continue;
    // Espalha todos os campos escalares do PlanetExample (inclui o par
    // inicial/final e referenceType automaticamente, sem listar campo a
    // campo) — só troca o `contextNode` incluído pelo `origin` resumido.
    const { contextNode, ...exampleFields } = example;
    trainingExamples[example.kind as PlanetExampleKind].push({
      ...exampleFields,
      origin: { planet: { id: contextNode.id, name: contextNode.name }, galaxy: { id: exampleGalaxy.id, name: exampleGalaxy.name } },
    });
  }

  return {
    position: { universo: { id: universo.id, name: universo.name }, galaxia: { id: galaxia.id, name: galaxia.name }, estrela: { id: estrela.id, name: estrela.name }, planeta: { id: planet.id, name: planet.name } },
    memoryPatterns,
    trainingExamples,
    designSystemStatus: galaxyLinks.length ? "LINKED" : "NONE_LINKED",
    designSystemComponents: galaxyLinks.flatMap((link) => link.source.components.map((component) => ({
      id: component.id, name: component.name, figmaComponentKey: component.figmaComponentKey,
      thumbnailUrl: component.thumbnailUrl, description: component.description, metadata: component.metadata,
      source: { id: link.source.id, name: link.source.name },
    }))),
  };
}
