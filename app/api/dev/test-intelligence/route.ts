import { NextResponse } from "next/server";
import { buildContextPackage } from "@/lib/nova/buildContextPackage";
import { db } from "@/lib/db";
import { recordApprovedPattern } from "@/lib/memory";

const PREFIX = "TESTE_N6_";

// Limpeza defensiva: só seleciona e remove registros cujo nome começa com TESTE_N6_.
async function cleanN6TestData() {
  const testNodes = await db.contextNode.findMany({ where: { name: { startsWith: PREFIX } }, select: { id: true, type: true } });
  const idsByType = (type: "PLANETA" | "ESTRELA" | "GALAXIA" | "UNIVERSO") => testNodes.filter((node) => node.type === type).map((node) => node.id);
  const planets = idsByType("PLANETA");
  const galaxies = idsByType("GALAXIA");

  if (planets.length) {
    await db.memoryPattern.deleteMany({ where: { contextNodeId: { in: planets } } });
    await db.planetExample.deleteMany({ where: { contextNodeId: { in: planets } } });
    await db.contextNode.deleteMany({ where: { id: { in: planets } } });
  }
  if (galaxies.length) await db.designSystemGalaxyLink.deleteMany({ where: { galaxyId: { in: galaxies } } });
  for (const type of ["ESTRELA", "GALAXIA", "UNIVERSO"] as const) {
    const ids = idsByType(type);
    if (ids.length) await db.contextNode.deleteMany({ where: { id: { in: ids } } });
  }
  await db.designSystemSource.deleteMany({ where: { name: { startsWith: PREFIX } } });
  await db.planetType.deleteMany({ where: { name: { startsWith: PREFIX } } });
}

// Rota manual apenas de desenvolvimento. Exercita a N6 sem persistir lixo no banco.
export async function GET() {
  if (process.env.NODE_ENV === "production") return NextResponse.json({ error: "Rota disponível apenas em desenvolvimento." }, { status: 404 });

  await cleanN6TestData();
  try {
    const planetType = await db.planetType.create({ data: { name: `${PREFIX}Listagem`, description: "Tipo criado para teste N6" } });
    const universe = await db.contextNode.create({ data: { type: "UNIVERSO", name: `${PREFIX}Universo` } });
    const galaxyOne = await db.contextNode.create({ data: { type: "GALAXIA", name: `${PREFIX}Galaxia_Origem`, parentId: universe.id } });
    const starOne = await db.contextNode.create({ data: { type: "ESTRELA", name: `${PREFIX}Estrela_Origem`, parentId: galaxyOne.id } });
    const planetOne = await db.contextNode.create({ data: { type: "PLANETA", name: `${PREFIX}Planeta_Origem`, parentId: starOne.id, planetTypeId: planetType.id } });
    const galaxyTwo = await db.contextNode.create({ data: { type: "GALAXIA", name: `${PREFIX}Galaxia_Destino`, parentId: universe.id } });
    const starTwo = await db.contextNode.create({ data: { type: "ESTRELA", name: `${PREFIX}Estrela_Destino`, parentId: galaxyTwo.id } });
    const planetTwo = await db.contextNode.create({ data: { type: "PLANETA", name: `${PREFIX}Planeta_Destino`, parentId: starTwo.id, planetTypeId: planetType.id } });
    const galaxyNone = await db.contextNode.create({ data: { type: "GALAXIA", name: `${PREFIX}Galaxia_Sem_DS`, parentId: universe.id } });
    const starNone = await db.contextNode.create({ data: { type: "ESTRELA", name: `${PREFIX}Estrela_Sem_DS`, parentId: galaxyNone.id } });
    const planetNone = await db.contextNode.create({ data: { type: "PLANETA", name: `${PREFIX}Planeta_Sem_DS`, parentId: starNone.id, planetTypeId: planetType.id } });

    const examples = await db.planetExample.createMany({ data: [
      { contextNodeId: planetOne.id, kind: "RAW_TRANSCRIPT", textContent: "TESTE_N6 transcrição de listagem", uploadedById: "TESTE_N6" },
      { contextNodeId: planetOne.id, kind: "FINAL_BDD_PBI", textContent: "TESTE_N6 BDD final", uploadedById: "TESTE_N6" },
      { contextNodeId: planetOne.id, kind: "WIREFRAME_REFERENCE", textContent: "TESTE_N6 wireframe de referência", uploadedById: "TESTE_N6" },
    ] });
    await recordApprovedPattern({ contextNodeId: planetTwo.id, patternType: "TESTE_N6_PATTERN", patternData: { source: "teste N6" }, initialConfidence: 0.88 });

    const sourceA = await db.designSystemSource.create({ data: { name: `${PREFIX}Fonte_A`, figmaFileKey: `${PREFIX}figma_a`, figmaUrl: "https://www.figma.com/file/TESTE_N6_A" } });
    const sourceB = await db.designSystemSource.create({ data: { name: `${PREFIX}Fonte_B`, figmaFileKey: `${PREFIX}figma_b`, figmaUrl: "https://www.figma.com/file/TESTE_N6_B" } });
    await db.designSystemComponent.createMany({ data: [
      { sourceId: sourceA.id, name: `${PREFIX}Botao`, figmaComponentKey: `${PREFIX}component_a` },
      { sourceId: sourceB.id, name: `${PREFIX}Tabela`, figmaComponentKey: `${PREFIX}component_b` },
    ] });
    await db.designSystemGalaxyLink.createMany({ data: [
      { sourceId: sourceA.id, galaxyId: galaxyTwo.id, linkedById: "TESTE_N6" },
      { sourceId: sourceB.id, galaxyId: galaxyTwo.id, linkedById: "TESTE_N6" },
    ] });

    const packageForSecondPlanet = await buildContextPackage(planetTwo.id);
    const packageWithoutDesignSystem = await buildContextPackage(planetNone.id);
    const crossTypeExampleVisible = packageForSecondPlanet.trainingExamples.RAW_TRANSCRIPT.some((example) => example.origin.planet.id === planetOne.id);
    const bothSourcesVisible = new Set(packageForSecondPlanet.designSystemComponents.map((component) => component.source.id)).size === 2;
    const noDesignSystemDetected = packageWithoutDesignSystem.designSystemStatus === "NONE_LINKED";

    if (!crossTypeExampleVisible || !bothSourcesVisible || !noDesignSystemDetected || examples.count !== 3) throw new Error("A verificação N6 não retornou todos os resultados esperados.");

    return NextResponse.json({ ok: true, package: packageForSecondPlanet, checks: { crossTypeExampleVisible, bothSourcesVisible, noDesignSystemDetected }, cleanup: "Todos os dados TESTE_N6_ serão removidos ao término da requisição." });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Erro desconhecido" }, { status: 500 });
  } finally {
    await cleanN6TestData();
  }
}
