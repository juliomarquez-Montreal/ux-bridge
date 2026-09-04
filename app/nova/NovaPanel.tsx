"use client";

import type { ContextNodeType } from "@prisma/client";
import { useCallback, useEffect, useMemo, useState } from "react";
import GlassCard from "@/components/GlassCard";
import PillButton from "@/components/PillButton";
import { PlusIcon } from "@/components/icons";
import DeleteConfirmModal from "./DeleteConfirmModal";
import NodeFormModal from "./NodeFormModal";
import NodeRow from "./NodeRow";
import { canCreateUniverso, flattenTree, getGalaxyAncestorId } from "./clientPermissions";
import type { ApiContextNode, ApiPlanetType, FormModalState, NovaUser } from "./types";

export default function NovaPanel({ user }: { user: NovaUser }) {
  const [tree, setTree] = useState<ApiContextNode[] | null>(null);
  const [planetTypes, setPlanetTypes] = useState<ApiPlanetType[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [formModal, setFormModal] = useState<FormModalState | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ApiContextNode | null>(null);

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

  useEffect(() => {
    refreshTree().catch(() => setLoadError("Não foi possível carregar a hierarquia. Tente recarregar a página."));

    fetch("/api/nova/planet-types")
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data: { planetTypes: ApiPlanetType[] }) => setPlanetTypes(data.planetTypes))
      .catch(() => setPlanetTypes([]));
  }, [refreshTree]);

  const byId = useMemo(() => flattenTree(tree ?? []), [tree]);
  const userGalaxyId = useMemo(
    () => (user.contextNodeId ? getGalaxyAncestorId(user.contextNodeId, byId) : null),
    [user.contextNodeId, byId]
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

  if (loadError && !tree) {
    return <p className="text-sm text-luminous-error">{loadError}</p>;
  }

  if (!tree) {
    return <p className="text-sm text-luminous-on-surface-variant">Carregando hierarquia...</p>;
  }

  return (
    <div>
      {loadError && <p className="mb-3 text-sm text-luminous-error">{loadError}</p>}

      {canCreateUniverso(user) && (
        <PillButton
          type="button"
          variant="secondary"
          className="mb-4 inline-flex items-center gap-1.5"
          onClick={() => setFormModal({ mode: "create", type: "UNIVERSO", parentId: null })}
        >
          <PlusIcon className="h-3.5 w-3.5" />
          Novo Universo
        </PillButton>
      )}

      {tree.length === 0 ? (
        <GlassCard className="text-center text-sm text-luminous-on-surface-variant">
          {canCreateUniverso(user)
            ? "Nenhum Universo cadastrado ainda. Crie o primeiro acima."
            : "A hierarquia ainda não foi configurada. Peça a um administrador para criar o primeiro Universo."}
        </GlassCard>
      ) : (
        <div className="space-y-2">
          {tree.map((node) => (
            <NodeRow
              key={node.id}
              node={node}
              depth={0}
              user={user}
              userGalaxyId={userGalaxyId}
              byId={byId}
              expanded={expanded}
              onToggleExpanded={toggleExpanded}
              onRequestCreate={handleRequestCreate}
              onRequestEdit={(node) => setFormModal({ mode: "edit", node })}
              onRequestDelete={(node) => setDeleteTarget(node)}
            />
          ))}
        </div>
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
