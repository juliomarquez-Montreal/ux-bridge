"use client";

import type { ContextNodeType } from "@prisma/client";
import { useCallback, useEffect, useMemo, useState } from "react";
import GlassCard from "@/components/GlassCard";
import PillButton from "@/components/PillButton";
import { EstrelaIcon, GalaxiaIcon, GearIcon, LayersIcon, PlanetaIcon, PlusIcon, SearchIcon, UniversoIcon } from "@/components/icons";
import DeleteConfirmModal from "./DeleteConfirmModal";
import DesignSystemTab from "./DesignSystemTab";
import NodeFormModal from "./NodeFormModal";
import NodeRow from "./NodeRow";
import PlanetTypesTab from "./PlanetTypesTab";
import { collectAllIds, filterTreeBySearch } from "./search";
import { canCreateUniverso, flattenTree, getGalaxyAncestorId } from "./clientPermissions";
import type { ApiContextNode, ApiDesignSystemSource, ApiPlanetType, FormModalState, NovaUser } from "./types";

type Tab = "universo" | "design-system" | "planetas";

const TABS: { key: Tab; label: string; icon: typeof UniversoIcon }[] = [
  { key: "universo", label: "Universo", icon: UniversoIcon },
  { key: "design-system", label: "Design System", icon: LayersIcon },
  { key: "planetas", label: "Gestão de Planetas", icon: GearIcon },
];

const TRAIL = [
  { label: "Universo", icon: UniversoIcon },
  { label: "Galáxia", icon: GalaxiaIcon },
  { label: "Estrela", icon: EstrelaIcon },
  { label: "Planeta", icon: PlanetaIcon },
];

const SEARCH_PLACEHOLDER: Record<Tab, string> = {
  universo: "Buscar na hierarquia...",
  "design-system": "Buscar Design Systems...",
  planetas: "Buscar tipos de Planeta...",
};

const PRIMARY_LABEL: Record<Tab, string> = {
  universo: "Novo universo",
  "design-system": "Novo Design System",
  planetas: "Novo Tipo",
};

export default function NovaPanel({ user }: { user: NovaUser }) {
  const [activeTab, setActiveTab] = useState<Tab>("universo");
  const [search, setSearch] = useState("");

  const [tree, setTree] = useState<ApiContextNode[] | null>(null);
  const [planetTypes, setPlanetTypes] = useState<ApiPlanetType[] | null>(null);
  const [sources, setSources] = useState<ApiDesignSystemSource[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [formModal, setFormModal] = useState<FormModalState | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ApiContextNode | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);

  const refreshTree = useCallback(async () => {
    const res = await fetch("/api/nova/nodes");
    if (!res.ok) throw new Error("Falha ao carregar a árvore.");
    const data = (await res.json()) as { tree: ApiContextNode[] };
    setTree(data.tree);
    setLoadError(null);

    // Expande Universo e Galáxia por padrão (visão geral sempre visível na
    // primeira carga); Estrela/Planeta ficam recolhidos até o usuário abrir.
    setExpanded((prev) => {
      if (prev.size > 0) return prev;
      const next = new Set<string>();
      function markTopLevels(nodes: ApiContextNode[]) {
        for (const node of nodes) {
          if (node.type === "UNIVERSO" || node.type === "GALAXIA") {
            next.add(node.id);
            markTopLevels(node.children);
          }
        }
      }
      markTopLevels(data.tree);
      return next;
    });
  }, []);

  const refreshPlanetTypes = useCallback(async () => {
    const res = await fetch("/api/nova/planet-types");
    if (!res.ok) throw new Error("Falha ao carregar tipos de planeta.");
    const data = (await res.json()) as { planetTypes: ApiPlanetType[] };
    setPlanetTypes(data.planetTypes);
  }, []);

  const refreshSources = useCallback(async () => {
    const res = await fetch("/api/nova/design-system/sources");
    if (!res.ok) throw new Error("Falha ao carregar Design Systems.");
    const data = (await res.json()) as { sources: ApiDesignSystemSource[] };
    setSources(data.sources);
  }, []);

  useEffect(() => {
    refreshTree().catch(() => setLoadError("Não foi possível carregar a hierarquia. Tente recarregar a página."));
    refreshPlanetTypes().catch(() => setPlanetTypes([]));
    refreshSources().catch(() => setSources([]));
  }, [refreshTree, refreshPlanetTypes, refreshSources]);

  const byId = useMemo(() => flattenTree(tree ?? []), [tree]);
  const userGalaxyId = useMemo(
    () => (user.contextNodeId ? getGalaxyAncestorId(user.contextNodeId, byId) : null),
    [user.contextNodeId, byId]
  );
  const galaxies = useMemo(() => Array.from(byId.values()).filter((node) => node.type === "GALAXIA"), [byId]);

  const filteredTree = useMemo(() => filterTreeBySearch(tree ?? [], search), [tree, search]);
  // Enquanto uma busca está ativa, força a expansão de tudo que sobrou no
  // resultado — senão um match a 3 níveis de profundidade fica escondido
  // atrás de um nó recolhido por padrão.
  const effectiveExpanded = useMemo(
    () => (search.trim() ? collectAllIds(filteredTree) : expanded),
    [search, filteredTree, expanded]
  );

  function toggleExpanded(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleRequestCreate(type: ContextNodeType, parentId: string) {
    setFormModal({ mode: "create", type, parentId });
  }

  async function handleSaved() {
    setFormModal(null);
    await refreshTree().catch(() => setLoadError("Não foi possível recarregar a hierarquia."));
  }

  async function handleDeleted() {
    setDeleteTarget(null);
    await refreshTree().catch(() => setLoadError("Não foi possível recarregar a hierarquia."));
  }

  function handlePrimaryAction() {
    if (activeTab === "universo") {
      setFormModal({ mode: "create", type: "UNIVERSO", parentId: null });
    } else {
      setShowCreateForm(true);
    }
  }

  const canUsePrimaryAction = activeTab === "universo" ? canCreateUniverso(user) : user.permissionLevel === "ADMIN";

  if (loadError && !tree) {
    return <p className="text-sm text-luminous-error">{loadError}</p>;
  }

  if (!tree) {
    return <p className="text-sm text-luminous-on-surface-variant">Carregando hierarquia...</p>;
  }

  return (
    <div>
      {/* Abas: navegação, visualmente distinta de botões de ação (sublinhado
          na aba ativa, sem preenchimento sólido — diferente do PillButton
          primário abaixo). */}
      <div className="mb-6 flex gap-1 overflow-x-auto border-b border-white/10">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => {
              setActiveTab(key);
              setSearch("");
            }}
            className={`flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition ${
              activeTab === key
                ? "border-luminous-primary text-luminous-on-surface"
                : "border-transparent text-luminous-on-surface-variant hover:text-luminous-on-surface"
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {activeTab === "universo" && (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
          {TRAIL.map(({ label, icon: Icon }, i) => (
            <span key={label} className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-xs text-luminous-on-surface-variant">
                <Icon className="h-3.5 w-3.5" />
                {label}
              </span>
              {i < TRAIL.length - 1 && <span className="text-luminous-on-surface-variant/40">→</span>}
            </span>
          ))}
        </div>
      )}

      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative min-w-[200px] flex-1">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-luminous-on-surface-variant" />
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={SEARCH_PLACEHOLDER[activeTab]}
            className="w-full rounded-lg border border-white/10 bg-black/30 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-luminous-primary"
          />
        </div>
        {canUsePrimaryAction && (
          <PillButton
            type="button"
            variant="primary"
            className="inline-flex items-center gap-1.5"
            onClick={handlePrimaryAction}
          >
            <PlusIcon className="h-3.5 w-3.5" />
            {PRIMARY_LABEL[activeTab]}
          </PillButton>
        )}
      </div>

      {loadError && <p className="mb-3 text-sm text-luminous-error">{loadError}</p>}

      {activeTab === "universo" &&
        (filteredTree.length === 0 ? (
          <GlassCard className="text-center text-sm text-luminous-on-surface-variant">
            {tree.length === 0
              ? canCreateUniverso(user)
                ? "Nenhum Universo cadastrado ainda. Crie o primeiro acima."
                : "A hierarquia ainda não foi configurada. Peça a um administrador para criar o primeiro Universo."
              : "Nenhum resultado para essa busca."}
          </GlassCard>
        ) : (
          <div className="space-y-2">
            {filteredTree.map((node) => (
              <NodeRow
                key={node.id}
                node={node}
                depth={0}
                user={user}
                userGalaxyId={userGalaxyId}
                byId={byId}
                expanded={effectiveExpanded}
                onToggleExpanded={toggleExpanded}
                onRequestCreate={handleRequestCreate}
                onRequestEdit={(n) => setFormModal({ mode: "edit", node: n })}
                onRequestDelete={(n) => setDeleteTarget(n)}
                sources={sources}
                onSourcesChanged={() => refreshSources().catch(() => {})}
              />
            ))}
          </div>
        ))}

      {activeTab === "design-system" && (
        <DesignSystemTab
          user={user}
          sources={sources}
          galaxies={galaxies}
          userGalaxyId={userGalaxyId}
          search={search}
          showCreateForm={showCreateForm}
          onCreateFormClose={() => setShowCreateForm(false)}
          onChanged={refreshSources}
        />
      )}

      {activeTab === "planetas" && (
        <PlanetTypesTab
          user={user}
          planetTypes={planetTypes}
          search={search}
          showCreateForm={showCreateForm}
          onCreateFormClose={() => setShowCreateForm(false)}
          onChanged={() => refreshPlanetTypes().catch(() => setPlanetTypes([]))}
        />
      )}

      {formModal && (
        <NodeFormModal
          state={formModal}
          planetTypes={planetTypes}
          onClose={() => setFormModal(null)}
          onSaved={handleSaved}
        />
      )}

      {deleteTarget && (
        <DeleteConfirmModal node={deleteTarget} onClose={() => setDeleteTarget(null)} onDeleted={handleDeleted} />
      )}
    </div>
  );
}
