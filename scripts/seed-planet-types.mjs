// Popula o catálogo global de PlanetType com os 5 tipos iniciais. Idempotente
// (upsert por nome).
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const PLANET_TYPES = [
  {
    name: "Listagem",
    description: "Tela que exibe múltiplos registros em formato de tabela ou cards, geralmente com filtros, busca e paginação.",
  },
  {
    name: "Formulário",
    description: "Tela para preencher ou editar dados através de campos de entrada, com validação e ação de salvar/enviar.",
  },
  {
    name: "Dashboard",
    description: "Painel com indicadores, gráficos e métricas resumidas, usado para visão geral e acompanhamento.",
  },
  {
    name: "Cadastro",
    description: "Fluxo de criação de um novo registro do zero, geralmente em etapas ou um formulário dedicado de criação.",
  },
  {
    name: "Detalhe",
    description: "Tela que exibe as informações completas de um único registro específico, geralmente aberta a partir de uma listagem.",
  },
];

for (const { name, description } of PLANET_TYPES) {
  const planetType = await db.planetType.upsert({
    where: { name },
    update: { description },
    create: { name, description },
  });
  console.log(`PlanetType: ${planetType.name}`);
}

await db.$disconnect();
