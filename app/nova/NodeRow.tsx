"use client";

import type { ContextNodeType } from "@prisma/client";
import { useState } from "react";
import Badge from "@/components/Badge";
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

const TYPE_ICON: Record<ContextNodeType, typeof UniversoIcon> = {
  UNIVERSO: UniversoIcon,
  GALAXIA: GalaxiaIcon,
  ESTRELA: EstrelaIcon,
  PLANETA: PlanetaIcon,
};

// Botão quadrado neutro (chevron/editar/vincular) — cor muda um pouco quando
// a linha está no estado "destacado" (expandida, com o card roxo por baixo).
function squareButtonClass(highlighted: boolean) {
  return highlighted
    ? "border-[#362f4d] bg-[#1b1629] hover:bg-[#2b2346] hover:border-[#554878]"
    : "border-[#2e2b3a] bg-[#171522] hover:bg-[#24212f] hover:border-[#433e57]";
}

// Pluralização simples — os 3 nomes de tipo (galáxia/estrela/planeta) são
// todos regulares em português (+s), não precisa de tabela irregular.
function pluralize(word: string, count: number): string {
  return count === 1 ? word : `${word}s`;
}

interface Props {
  node: ApiContextNode;
  depth: number;
  user: NovaUser;
  userGalaxyIds: Set<string>;
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
// Visual segue o mockup HTML NOVA.dc.html (Layout/HTML UI NOVA.zip): raiz
// (Universo) sem card, filhos em cards conectados por linhas com marcador
// circular, card ganha um tom roxo quando a linha está expandida.
export default function NodeRow({
  node,
  depth,
  user,
  userGalaxyIds,
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

  const Icon = TYPE_ICON[node.type];
  const isExpanded = expanded.has(node.id);
  const isRoot = depth === 0;
  const isPlaneta = node.type === "PLANETA";
  const isGalaxia = node.type === "GALAXIA";
  const hasChildren = node.children.length > 0;
  // Planeta não tem filhos na árvore, mas o "expandir" ainda serve pra
  // mostrar/esconder os exemplos de treino. Galáxia sem Estrela também é
  // expansível: em vez da lista de filhos (vazia), mostra o convite pra
  // vincular um Design System — nunca os dois ao mesmo tempo.
  const isExpandable = hasChildren || isPlaneta || isGalaxia;
  const childType = CHILD_TYPE[node.type];
  // Badge "Sua Galáxia" só faz sentido pra usuário comum (vínculo explícito
  // em UserGalaxyAccess) — ADMIN "tem acesso" a todas por definição, então
  // mostrar em toda linha só viraria ruído sem significado.
  const isUserGalaxy = node.type === "GALAXIA" && user.permissionLevel !== "ADMIN" && userGalaxyIds.has(node.id);

  const canCreateChild = childType !== null && canCreateChildOf(node, user, userGalaxyIds, byId);
  const canModify = canModifyNode(node, user, userGalaxyIds, byId);
  // Vincular/desvincular Design System segue a mesma regra de criar
  // Estrela nesta Galáxia (ADMIN em qualquer uma, usuário comum só na própria).
  const canLinkDesignSystem = isGalaxia && canCreateChild;
  const linkedSources = isGalaxia ? (sources ?? []).filter((s) => s.galaxyLinks.some((l) => l.galaxyId === node.id)) : [];

  const childCountLabel =
    childType && node.children.length > 0
      ? `${node.children.length} ${pluralize(TYPE_LABEL[childType].toLowerCase(), node.children.length)}`
      : null;

  // Card só existe a partir da profundidade 1 — a raiz fica "solta" dentro
  // do container da árvore. Quando expandida, o card ganha o tom roxo.
  const highlighted = !isRoot && isExpanded;
  const cardClass = isRoot
    ? ""
    : highlighted
      ? "rounded-[6px] border border-[#3a2e62] bg-gradient-to-b from-[#1d1633] to-[#1b1530]"
      : "rounded-[6px] border border-[#2a2735] bg-[#13111c]";

  const nameSizeClass = isRoot ? "text-[21.5px] leading-7 tracking-[-0.2px]" : "text-[19px] leading-[26px] tracking-[-0.3px]";
  const circleSizeClass = isRoot ? "h-[49px] w-[49px]" : "h-[43px] w-[43px]";
  const circleIconSizeClass = isRoot ? "h-9 w-9" : "h-7 w-7";
  const circleClass = isRoot
    ? "border-[#2f2a45] bg-[#1a1729]"
    : highlighted
      ? "border-[#3b3060] bg-[#261e45]"
      : "border-[#33294f] bg-[#1d1733]";

  return (
    <div className={cardClass}>
      <div className="flex flex-wrap items-center gap-3 px-4 py-3.5">
        <button
          type="button"
          onClick={() => onToggleExpanded(node.id)}
          disabled={!isExpandable}
          aria-label={isExpanded ? "Recolher" : isPlaneta ? "Ver exemplos de treino" : "Expandir"}
          title={isPlaneta ? "Exemplos de treino" : undefined}
          className={`grid h-[46px] w-[46px] shrink-0 place-items-center rounded-[5px] border transition ${
            isExpandable ? squareButtonClass(highlighted) : "border-transparent opacity-0"
          }`}
        >
          <ChevronDownIcon className={`h-5 w-5 text-[#e8e6f0] transition-transform ${isExpanded ? "" : "-rotate-90"}`} />
        </button>

        <span className={`grid shrink-0 place-items-center rounded-full border ${circleSizeClass} ${circleClass}`}>
          <Icon className={`${circleIconSizeClass} text-[#f0eef8]`} strokeWidth={1.4} />
        </span>

        <span className={`min-w-0 truncate font-medium text-[#f7f5fc] ${nameSizeClass}`}>{node.name}</span>

        <span className="shrink-0 rounded-[4px] border border-[#473a74] bg-[#1c1634] px-2.5 py-1 font-mono text-[11.5px] font-bold uppercase tracking-[0.6px] text-[#c3b1fb]">
          {TYPE_LABEL[node.type]}
        </span>

        {isUserGalaxy && <Badge variant="info">Sua Galáxia</Badge>}

        {childCountLabel && (
          <span className="inline-flex shrink-0 items-center gap-[11px] text-[15px] text-[#b4b1c1]">
            <LayersIcon className="h-[21px] w-[21px] text-[#b7b4c4]" />
            {childCountLabel}
          </span>
        )}

        {isGalaxia && (
          <span className="inline-flex shrink-0 items-center gap-[11px] text-[15px] text-[#b4b1c1]">
            <LayersIcon className="h-[21px] w-[21px] text-[#b7b4c4]" />
            {linkedSources.length === 0 ? "Sem Design System" : `${linkedSources.length} fonte(s) vinculada(s)`}
          </span>
        )}

        <div className="ml-auto flex shrink-0 items-center gap-2.5">
          {canCreateChild && childType && (
            <button
              type="button"
              onClick={() => onRequestCreate(childType, node.id)}
              aria-label={`Criar ${TYPE_LABEL[childType]}`}
              className="inline-flex h-12 items-center gap-[11px] rounded-[5px] border border-[#7456d8] bg-[#1a1433] px-4 text-[17px] font-medium text-[#cbbaff] transition hover:border-[#9477f2] hover:bg-[#261d4a] hover:shadow-[0_0_0_3px_rgba(116,86,216,0.2)]"
            >
              <PlusIcon className="h-[17px] w-[17px] text-[#c7b6ff]" />
              {TYPE_LABEL[childType]}
            </button>
          )}
          {canLinkDesignSystem && (
            <button
              type="button"
              onClick={() => setShowLinkModal(true)}
              aria-label="Vincular Design System"
              title="Vincular Design System"
              className={`grid h-[47px] w-[47px] place-items-center rounded-[5px] border transition ${squareButtonClass(highlighted)}`}
            >
              <LinkIcon className="h-[18px] w-[18px] text-[#eeecf5]" />
            </button>
          )}
          {canModify && (
            <>
              <button
                type="button"
                onClick={() => onRequestEdit(node)}
                aria-label={`Editar ${node.name}`}
                title="Editar"
                className={`grid h-[47px] w-[47px] place-items-center rounded-[5px] border transition ${squareButtonClass(highlighted)}`}
              >
                <EditIcon className="h-[18px] w-[18px] text-[#eeecf5]" />
              </button>
              <OverflowMenu
                ariaLabel={`Mais ações para ${node.name}`}
                items={[{ label: "Excluir", danger: true, onClick: () => onRequestDelete(node) }]}
              />
            </>
          )}
        </div>
      </div>

      {isExpanded && isGalaxia && !hasChildren && (
        <div className="px-4 pb-8 pt-1 sm:px-6">
          <GalaxyDesignSystemPanel
            hasLinkedSources={linkedSources.length > 0}
            canLink={canLinkDesignSystem}
            onLinkClick={() => setShowLinkModal(true)}
          />
        </div>
      )}

      {isExpanded && hasChildren && (
        <div className="relative mt-2 pl-9">
          <div className="absolute bottom-0 left-[9px] top-0 w-[1.5px] bg-[#4a3b86]" />
          <div className="space-y-2">
            {node.children.map((child) => (
              <div key={child.id} className="relative">
                <span className="absolute left-[-27px] top-[26px] h-[1.5px] w-[27px] bg-[#4a3b86]" />
                <span className="absolute left-[-36.5px] top-[16.5px] flex h-[19px] w-[19px] items-center justify-center rounded-full border-[1.5px] border-[#8d68f0] bg-[#1b1535]">
                  <span className="h-2 w-2 rounded-full bg-[#9b78f6]" />
                </span>
                <NodeRow
                  node={child}
                  depth={depth + 1}
                  user={user}
                  userGalaxyIds={userGalaxyIds}
                  byId={byId}
                  expanded={expanded}
                  onToggleExpanded={onToggleExpanded}
                  onRequestCreate={onRequestCreate}
                  onRequestEdit={onRequestEdit}
                  onRequestDelete={onRequestDelete}
                  sources={sources}
                  onSourcesChanged={onSourcesChanged}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {isExpanded && isPlaneta && (
        <div className="relative mt-2 pl-9 pb-2">
          <div className="absolute bottom-2 left-[9px] top-0 w-[1.5px] bg-[#4a3b86]" />
          <PlanetExamplesPanel node={node} canManage={canModify} />
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

// Convite pra vincular um Design System, mostrado só quando a Galáxia
// expandida não tem nenhuma Estrela — nunca junto da lista de filhos (isso
// era o bug: o card aparecia duplicado, também dentro de galáxias com
// conteúdo real). Visual e textos batem com o mockup HTML NOVA.dc.html.
function GalaxyDesignSystemPanel({
  hasLinkedSources,
  canLink,
  onLinkClick,
}: {
  hasLinkedSources: boolean;
  canLink: boolean;
  onLinkClick: () => void;
}) {
  return (
    <div className="rounded-[4px] border border-[#2f2944] bg-[#110e1b] px-8 py-10">
      <h4 className="mb-6 text-[19px] text-[#f1eff7]">Design System</h4>
      {hasLinkedSources ? (
        <p className="text-center text-[15.5px] text-[#aeabbc]">
          Fontes já vinculadas — veja os detalhes na aba &quot;Design System&quot;.
        </p>
      ) : (
        <div className="flex flex-col items-center">
          <LayersIcon className="mb-4 h-14 w-14 text-[#a684fa]" strokeWidth={1.1} />
          <p className="max-w-xl text-center text-[19.5px] font-semibold text-[#f7f5fc]">
            Nenhuma fonte vinculada a esta galáxia.
          </p>
          <p className="mt-2 max-w-lg text-center text-[15.5px] text-[#aeabbc]">
            Conecte um Design System para enriquecer a memória visual do projeto.
          </p>
          {canLink && (
            <button
              type="button"
              onClick={onLinkClick}
              className="mt-8 inline-flex h-[52px] items-center gap-[13px] rounded-[4px] border border-[#8a66ee] bg-[#6a3bd6] px-7 text-[18px] font-medium text-white transition hover:border-[#a78bfa] hover:bg-[#7a4ae8] hover:shadow-[0_0_0_3px_rgba(122,74,232,0.25),0_6px_20px_rgba(106,59,214,0.35)]"
            >
              <LinkIcon className="h-[21px] w-[21px]" />
              Vincular Design System
            </button>
          )}
        </div>
      )}
    </div>
  );
}
