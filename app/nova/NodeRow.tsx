"use client";

import type { ContextNodeType } from "@prisma/client";
import { useState } from "react";
import Badge from "@/components/Badge";
import PillButton from "@/components/PillButton";
import {
  ChevronDownIcon,
  EditIcon,
  EstrelaIcon,
  GalaxiaIcon,
  LayersIcon,
  LinkIcon,
  PlanetaIcon,
  PlusIcon,
  UniversoIcon,
} from "@/components/icons";
import DesignSystemLinkModal from "./DesignSystemLinkModal";
import OverflowMenu from "./OverflowMenu";
import PlanetExamplesPanel from "./PlanetExamplesPanel";
import { CHILD_TYPE, TYPE_LABEL, canCreateChildOf, canModifyNode } from "./clientPermissions";
import type { ApiContextNode, ApiDesignSystemSource, NovaUser } from "./types";

const TYPE_STYLES: Record<ContextNodeType, { icon: typeof UniversoIcon; accent: string; ring: string }> = {
  UNIVERSO: { icon: UniversoIcon, accent: "text-luminous-primary-fixed-dim", ring: "border-luminous-primary/30 bg-luminous-primary/5" },
  GALAXIA: { icon: GalaxiaIcon, accent: "text-luminous-secondary", ring: "border-luminous-secondary/25 bg-luminous-secondary/5" },
  ESTRELA: { icon: EstrelaIcon, accent: "text-luminous-tertiary", ring: "border-luminous-tertiary/25 bg-luminous-tertiary/5" },
  PLANETA: { icon: PlanetaIcon, accent: "text-emerald-300", ring: "border-emerald-300/20 bg-emerald-300/5" },
};

// Pluralização simples — os 3 nomes de tipo (galáxia/estrela/planeta) são
// todos regulares em português (+s), não precisa de tabela irregular.
function pluralize(word: string, count: number): string {
  return count === 1 ? word : `${word}s`;
}

interface Props {
  node: ApiContextNode;
  depth: number;
  user: NovaUser;
  userGalaxyId: string | null;
  byId: Map<string, ApiContextNode>;
  expanded: Set<string>;
  onToggleExpanded: (id: string) => void;
  onRequestCreate: (type: ContextNodeType, parentId: string) => void;
  onRequestEdit: (node: ApiContextNode) => void;
  onRequestDelete: (node: ApiContextNode) => void;
  sources: ApiDesignSystemSource[] | null;
  onSourcesChanged: () => void;
}

// Uma linha da árvore NOVA, renderizada recursivamente para seus filhos.
export default function NodeRow({
  node,
  depth,
  user,
  userGalaxyId,
  byId,
  expanded,
  onToggleExpanded,
  onRequestCreate,
  onRequestEdit,
  onRequestDelete,
  sources,
  onSourcesChanged,
}: Props) {
  const [showLinkModal, setShowLinkModal] = useState(false);

  const style = TYPE_STYLES[node.type];
  const Icon = style.icon;
  const isExpanded = expanded.has(node.id);
  const isPlaneta = node.type === "PLANETA";
  const isGalaxia = node.type === "GALAXIA";
  const hasChildren = node.children.length > 0;
  // Planeta não tem filhos na árvore, mas o "expandir" ainda serve pra
  // mostrar/esconder os exemplos de treino. Galáxia sempre expansível (mesmo
  // sem Estrela ainda) pra poder chegar na seção de Design System dela.
  const isExpandable = hasChildren || isPlaneta || isGalaxia;
  const childType = CHILD_TYPE[node.type];
  const isUserGalaxy = node.type === "GALAXIA" && node.id === userGalaxyId;

  const canCreateChild = childType !== null && canCreateChildOf(node, user, userGalaxyId, byId);
  const canModify = canModifyNode(node, user, userGalaxyId, byId);
  // Vincular/desvincular Design System segue a mesma regra de criar
  // Estrela nesta Galáxia (ADMIN em qualquer uma, usuário comum só na própria).
  const canLinkDesignSystem = isGalaxia && canCreateChild;
  const linkedSources = isGalaxia ? (sources ?? []).filter((s) => s.galaxyLinks.some((l) => l.galaxyId === node.id)) : [];

  const childCountLabel =
    childType && node.children.length > 0
      ? `${node.children.length} ${pluralize(TYPE_LABEL[childType].toLowerCase(), node.children.length)}`
      : null;

  return (
    <div className={depth > 0 ? "ml-6 border-l border-white/10 pl-5" : ""}>
      <div
        className={`flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3.5 ${style.ring} ${
          isUserGalaxy ? "ring-1 ring-luminous-primary/50" : ""
        }`}
      >
        <button
          type="button"
          onClick={() => onToggleExpanded(node.id)}
          disabled={!isExpandable}
          aria-label={isExpanded ? "Recolher" : isPlaneta ? "Ver exemplos de treino" : "Expandir"}
          title={isPlaneta ? "Exemplos de treino" : undefined}
          className={`grid h-7 w-7 shrink-0 place-items-center rounded-md transition ${
            isExpandable ? "hover:bg-white/10" : "opacity-0"
          }`}
        >
          <ChevronDownIcon className={`h-5 w-5 transition-transform ${isExpanded ? "" : "-rotate-90"}`} />
        </button>

        <Icon className={`h-5 w-5 shrink-0 ${style.accent}`} />

        <span className="min-w-0 truncate text-base font-medium text-luminous-on-surface">{node.name}</span>

        <span className={`shrink-0 font-mono text-xs uppercase tracking-[0.1em] ${style.accent}`}>
          {TYPE_LABEL[node.type]}
        </span>

        {isUserGalaxy && <Badge variant="info">Sua Galáxia</Badge>}

        {childCountLabel && (
          <span className="inline-flex shrink-0 items-center gap-1.5 text-sm text-luminous-on-surface-variant/70">
            <LayersIcon className="h-4 w-4" />
            {childCountLabel}
          </span>
        )}

        {isGalaxia && (
          <span className="inline-flex shrink-0 items-center gap-1.5 text-sm text-luminous-on-surface-variant/70">
            <LayersIcon className="h-4 w-4" />
            {linkedSources.length === 0 ? "Sem Design System" : `${linkedSources.length} fonte(s) vinculada(s)`}
          </span>
        )}

        <div className="ml-auto flex shrink-0 items-center gap-2">
          {canCreateChild && childType && (
            <PillButton
              type="button"
              variant="secondary"
              className="!rounded-lg !px-3.5 !py-2 !font-inter !text-sm !normal-case !tracking-normal inline-flex items-center gap-1.5"
              onClick={() => onRequestCreate(childType, node.id)}
              aria-label={`Criar ${TYPE_LABEL[childType]}`}
            >
              <PlusIcon className="h-3.5 w-3.5" />
              {TYPE_LABEL[childType]}
            </PillButton>
          )}
          {canLinkDesignSystem && (
            <button
              type="button"
              onClick={() => setShowLinkModal(true)}
              aria-label="Vincular Design System"
              title="Vincular Design System"
              className="grid h-9 w-9 place-items-center rounded-md border border-white/10 bg-white/5 hover:bg-white/10"
            >
              <LinkIcon className="h-4 w-4" />
            </button>
          )}
          {canModify && (
            <>
              <button
                type="button"
                onClick={() => onRequestEdit(node)}
                aria-label={`Editar ${node.name}`}
                title="Editar"
                className="grid h-9 w-9 place-items-center rounded-md border border-white/10 bg-white/5 hover:bg-white/10"
              >
                <EditIcon className="h-4 w-4" />
              </button>
              <OverflowMenu
                ariaLabel={`Mais ações para ${node.name}`}
                items={[{ label: "Excluir", danger: true, onClick: () => onRequestDelete(node) }]}
              />
            </>
          )}
        </div>
      </div>

      {isExpanded && hasChildren && (
        <div className="mt-2 space-y-2">
          {node.children.map((child) => (
            <NodeRow
              key={child.id}
              node={child}
              depth={depth + 1}
              user={user}
              userGalaxyId={userGalaxyId}
              byId={byId}
              expanded={expanded}
              onToggleExpanded={onToggleExpanded}
              onRequestCreate={onRequestCreate}
              onRequestEdit={onRequestEdit}
              onRequestDelete={onRequestDelete}
              sources={sources}
              onSourcesChanged={onSourcesChanged}
            />
          ))}
        </div>
      )}

      {isExpanded && isPlaneta && (
        <div className="ml-6 mt-2 border-l border-white/10 pl-5">
          <PlanetExamplesPanel node={node} canManage={canModify} />
        </div>
      )}

      {isExpanded && isGalaxia && (
        <div className="ml-6 mt-2 border-l border-white/10 pl-5">
          <div className="space-y-3 py-2">
            <h4 className="text-xs font-semibold uppercase tracking-[.05em] text-luminous-on-surface-variant">
              Design System
            </h4>

            {linkedSources.length === 0 ? (
              <div className="rounded-lg border border-dashed border-white/15 px-6 py-8 text-center">
                <LayersIcon className="mx-auto mb-2 h-7 w-7 text-luminous-on-surface-variant/40" />
                <p className="text-sm font-medium text-luminous-on-surface">Nenhuma fonte vinculada a esta galáxia.</p>
                <p className="mx-auto mt-1 max-w-xs text-xs text-luminous-on-surface-variant">
                  Conecte um Design System para enriquecer a memória visual do projeto.
                </p>
                {canLinkDesignSystem && (
                  <PillButton
                    type="button"
                    variant="primary"
                    className="!font-inter !normal-case !tracking-normal mx-auto mt-4 inline-flex items-center gap-1.5"
                    onClick={() => setShowLinkModal(true)}
                  >
                    <LinkIcon className="h-3.5 w-3.5" />
                    Vincular Design System
                  </PillButton>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {linkedSources.map((source) => (
                  <div key={source.id} className="rounded-lg border border-white/10 bg-white/5 p-3">
                    <p className="truncate text-sm font-medium text-luminous-on-surface">{source.name}</p>
                    <p className="text-[11px] text-luminous-on-surface-variant/70">
                      {source.components.length} componente(s)
                    </p>
                  </div>
                ))}
                {canLinkDesignSystem && (
                  <PillButton
                    type="button"
                    variant="inactive"
                    className="!font-inter !normal-case !tracking-normal inline-flex items-center gap-1.5"
                    onClick={() => setShowLinkModal(true)}
                  >
                    <LinkIcon className="h-3.5 w-3.5" />
                    Gerenciar vínculos
                  </PillButton>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {showLinkModal && (
        <DesignSystemLinkModal
          title={`Vincular Design System a "${node.name}"`}
          emptyMessage="Nenhum Design System cadastrado ainda. Peça a um administrador para criar um na aba Design System."
          items={(sources ?? []).map((source) => ({
            id: source.id,
            label: source.name,
            sublabel: `${source.components.length} componente(s)`,
            linked: source.galaxyLinks.some((link) => link.galaxyId === node.id),
          }))}
          onToggle={async (sourceId, nextLinked) => {
            const res = nextLinked
              ? await fetch(`/api/nova/design-system/sources/${sourceId}/galaxies`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ galaxyId: node.id }),
                })
              : await fetch(`/api/nova/design-system/sources/${sourceId}/galaxies/${node.id}`, { method: "DELETE" });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error ?? "Falha ao salvar.");
            onSourcesChanged();
          }}
          onClose={() => setShowLinkModal(false)}
        />
      )}
    </div>
  );
}
