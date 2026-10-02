"use client";

import type { ContextNodeType } from "@prisma/client";
import { useCallback, useEffect, useMemo, useState } from "react";
import GlassCard from "@/components/GlassCard";
import { ArrowRightIcon, EstrelaIcon, GalaxiaIcon, GearIcon, LayersIcon, PlanetaIcon, PlusIcon, SearchIcon, UniversoIcon } from "@/components/icons";
import DeleteConfirmModal from "./DeleteConfirmModal";
import DesignSystemTab from "./DesignSystemTab";
import NodeFormModal from "./NodeFormModal";
import NodeRow from "./NodeRow";
import PbiStyleSourcesSection from "./PbiStyleSourcesSection";
import PlanetTypesTab from "./PlanetTypesTab";
import { collectAllIds, filterTreeBySearch } from "./search";
import { canCreateUniverso, flattenTree } from "./clientPermissions";
import type { ApiContextNode, ApiDesignSystemSource, ApiPlanetType, ApiUserGalaxy, FormModalState, NovaUser } from "./types";

type Tab = "universo" | "design-system" | "planetas";

const TABS: { key: Tab; label: string; icon: typeof UniversoIcon }[] = [
  { key: "universo", label: "Universo", icon: UniversoIcon },
  { key: "design-system", label: "Ajustes Design System e PBIs", icon: LayersIcon },
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
  const [userGalaxyIds, setUserGalaxyIds] = useState<Set<string>>(new Set());
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

  const refreshUserGalaxies = useCallback(async () => {
    const res = await fetch("/api/nova/users/me/galaxies");
    if (!res.ok) throw new Error("Falha ao carregar Galáxias do usuário.");
    const data = (await res.json()) as { galaxies: ApiUserGalaxy[] };
    setUserGalaxyIds(new Set(data.galaxies.map((g) => g.id)));
  }, []);

  useEffect(() => {
    refreshTree().catch(() => setLoadError("Não foi possível carregar a hierarquia. Tente recarregar a página."));
    refreshPlanetTypes().catch(() => setPlanetTypes([]));
    refreshSources().catch(() => setSources([]));
    refreshUserGalaxies().catch(() => setUserGalaxyIds(new Set()));
  }, [refreshTree, refreshPlanetTypes, refreshSources, refreshUserGalaxies]);

  const byId = useMemo(() => flattenTree(tree ?? []), [tree]);
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
      <h1 className="text-3xl font-bold text-white">NOVA</h1>
      <p className="mt-1 text-sm text-luminous-on-surface-variant">
        Organize o contexto que orienta a criação de PBIs e wireframes.
      </p>

      {/* Abas: a ativa ganha um "cartão" com gradiente + borda nas laterais e
          topo (sem borda embaixo) e um filete de 3px por baixo — igual ao
          mockup HTML NOVA.dc.html, não um segmented-control genérico. */}
      {/* overflow-y-hidden é necessário aqui: por spec, um elemento com
          overflow-x diferente de visible e overflow-y "visible" vira
          overflow-y "auto" automaticamente — sem isso, alguns navegadores
          desenhavam uma barra de rolagem vertical indevida ao lado das abas. */}
      <div className="relative mt-7 flex gap-0 overflow-x-auto overflow-y-hidden border-b border-[#252231]">
        {TABS.map(({ key, label, icon: Icon }) => {
          const isActive = activeTab === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => {
                setActiveTab(key);
                setSearch("");
              }}
              className={`relative flex shrink-0 items-center justify-center gap-2.5 px-5 py-3.5 text-[16px] transition ${
                isActive
                  ? "rounded-t-[3px] border border-b-0 border-[#2c2550] bg-gradient-to-b from-[#1a1532] to-[#1d1738] font-medium text-[#f6f4fb]"
                  : "text-[#c3c0cf] hover:bg-white/[0.035]"
              }`}
            >
              <Icon className={`h-5 w-5 ${isActive ? "text-[#f3f1fa]" : "text-[#bdb9ca]"}`} />
              {label}
              {isActive && <span className="absolute inset-x-0 -bottom-px h-[3px] rounded-[1px] bg-[#8e63f2]" />}
            </button>
          );
        })}
      </div>

      {activeTab === "universo" && (
        <div className="mb-5 mt-6 flex flex-wrap items-center gap-2">
          {TRAIL.map(({ label, icon: Icon }, i) => (
            <span key={label} className="flex items-center gap-2">
              <span className="inline-flex h-8 items-center gap-2 rounded-full border border-[#2e2b3b] bg-[#12101b] pl-3.5 pr-4 text-sm font-medium text-[#eeecf5]">
                <Icon className="h-4 w-4 text-[#b9a4f7]" />
                {label}
              </span>
              {i < TRAIL.length - 1 && <ArrowRightIcon className="h-4 w-4 text-[#9f9bb0]" />}
            </span>
          ))}
        </div>
      )}

      <div className="mb-5 mt-6 flex flex-wrap gap-4">
        <div className="relative min-w-[200px] flex-1">
          <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#a9a6b8]" />
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={SEARCH_PLACEHOLDER[activeTab]}
            className="h-11 w-full rounded-lg border border-[#2b2837] bg-[#100e18] pl-10 pr-4 text-sm text-[#f1eff7] outline-none placeholder:text-[#8c899c] hover:border-[#443d5e] focus:border-[#443d5e]"
          />
        </div>
        {canUsePrimaryAction && (
          <button
            type="button"
            onClick={handlePrimaryAction}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-[#8a66ee] bg-[#6a3bd6] px-5 text-sm font-semibold text-white transition hover:bg-[#7a4ae8] hover:border-[#a78bfa] hover:shadow-[0_0_0_3px_rgba(122,74,232,0.25),0_6px_20px_rgba(106,59,214,0.35)]"
          >
            <PlusIcon className="h-4 w-4" />
            {PRIMARY_LABEL[activeTab]}
          </button>
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
          <div className="rounded-lg border border-[#23202e] bg-[rgba(14,12,22,0.92)] p-6 sm:p-8">
            <div className="space-y-2">
              {filteredTree.map((node) => (
                <NodeRow
                  key={node.id}
                  node={node}
                  depth={0}
                  user={user}
                  userGalaxyIds={userGalaxyIds}
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
          </div>
        ))}

      {activeTab === "design-system" && (
        <>
          <DesignSystemTab
            user={user}
            sources={sources}
            galaxies={galaxies}
            userGalaxyIds={userGalaxyIds}
            search={search}
            showCreateForm={showCreateForm}
            onCreateFormClose={() => setShowCreateForm(false)}
            onChanged={refreshSources}
          />
          <PbiStyleSourcesSection user={user} galaxies={galaxies} userGalaxyIds={userGalaxyIds} />
        </>
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
