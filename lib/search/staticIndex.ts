// Índice ESTÁTICO de páginas e ações do sistema, buscável no Ctrl+K junto com
// os resultados dinâmicos (Bridges/Projetos/NOVA). Entrada com `action` não
// navega: dispara algo (ex: abrir o modal de criar Bridge).

export type StaticIcon = "plus" | "bridge" | "project" | "wireframe" | "nova" | "activity" | "settings" | "users" | "dashboard" | "profile";

export interface StaticEntry {
  title: string;
  description: string;
  category: "Bridges" | "Projetos" | "Wireframes" | "NOVA" | "Atividades" | "Sistema";
  icon: StaticIcon;
  href?: string;
  action?: "create-bridge";
  adminOnly?: boolean;
  // Palavras extras que também levam a esta entrada.
  keywords?: string;
}

export const STATIC_INDEX: StaticEntry[] = [
  { title: "Criar novo Bridge", description: "Enviar um material e gerar o Bridge Spec (BS)", category: "Bridges", icon: "plus", action: "create-bridge", keywords: "novo bridge criar nova bridge material transcrição" },
  { title: "Módulo Bridges", description: "Lista de todos os Bridges e o andamento de cada um", category: "Bridges", icon: "bridge", href: "/bridges", keywords: "bridges lista acompanhar status" },
  { title: "Bridges criados", description: "Ver, filtrar e excluir os Bridges já criados", category: "Bridges", icon: "bridge", href: "/bridges", keywords: "bridge listagem tabela" },
  { title: "Bridges aguardando aprovação", description: "Bridge Spec ou Wireframe esperando aprovação", category: "Bridges", icon: "bridge", href: "/bridges", keywords: "pendente aprovar aprovação bridge spec" },
  { title: "Módulo Projetos", description: "Projetos que agrupam vários Bridges e colaboradores", category: "Projetos", icon: "project", href: "/projetos", keywords: "projetos lista" },
  { title: "Criar novo Projeto", description: "Agrupar Bridges sob um mesmo Projeto de entrega", category: "Projetos", icon: "plus", href: "/projetos?novo=1", keywords: "novo projeto criar" },
  { title: "Ferramentas do PO", description: "Radar de escopo, conflitos, dependências e comparador de Specs (dentro de um Projeto)", category: "Projetos", icon: "project", href: "/projetos", keywords: "radar escopo conflitos dependências comparador áreas ferramentas po" },
  { title: "Módulo Wireframes", description: "Biblioteca dos Wireframes já gerados", category: "Wireframes", icon: "wireframe", href: "/wireframes", keywords: "wireframes lista" },
  { title: "Wireframes gerados", description: "Baixar o SVG, copiar o link ou enviar por e-mail", category: "Wireframes", icon: "wireframe", href: "/wireframes", keywords: "wireframe svg download baixar compartilhar" },
  { title: "NOVA — Organizar hierarquia", description: "Universo, Galáxia, Estrela e Planeta", category: "NOVA", icon: "nova", href: "/nova", keywords: "nova hierarquia universo galáxia galaxia estrela planeta contexto árvore" },
  { title: "NOVA — Design System e PBIs de exemplo", description: "Fontes do Figma e PBIs que ensinam o estilo de escrita", category: "NOVA", icon: "nova", href: "/nova", keywords: "design system figma pbi estilo componentes" },
  { title: "NOVA — Gestão de Planetas (Tipos)", description: "Tipos de Planeta e seus exemplos de treino", category: "NOVA", icon: "nova", href: "/nova", keywords: "tipos de planeta exemplos treino" },
  { title: "Dashboard", description: "Números reais: eficiência, tempos, entrega e fluxos", category: "Sistema", icon: "dashboard", href: "/", keywords: "início home painel métricas indicadores gráficos" },
  { title: "Atividades", description: "Histórico de ações: Bridges, Wireframes, Projetos e NOVA", category: "Atividades", icon: "activity", href: "/atividades", keywords: "histórico auditoria log ações recentes" },
  { title: "Meu perfil", description: "Seus dados, foto e senha", category: "Sistema", icon: "profile", href: "/profile", keywords: "perfil conta senha foto avatar" },
  { title: "Configurações", description: "Engine de IA e configurações do sistema", category: "Sistema", icon: "settings", href: "/settings", adminOnly: true, keywords: "configurações ajustes engine ia gemini chave api" },
  { title: "Usuários", description: "Criar e gerenciar usuários, funções e acessos", category: "Sistema", icon: "users", href: "/usuarios", adminOnly: true, keywords: "usuários usuarios pessoas acesso permissão função galáxias" },
  { title: "Criar novo usuário", description: "Cadastrar uma pessoa no sistema", category: "Sistema", icon: "plus", href: "/usuarios?novo=1", adminOnly: true, keywords: "novo usuário cadastrar" },
];
