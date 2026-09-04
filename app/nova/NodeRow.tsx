"use client";

import type { ContextNodeType } from "@prisma/client";
import Badge from "@/components/Badge";
import {
  ChevronDownIcon,
  EditIcon,
  EstrelaIcon,
  GalaxiaIcon,
  PlanetaIcon,
  PlusIcon,
  TrashIcon,
  UniversoIcon,
} from "@/components/icons";
import PlanetExamplesPanel from "./PlanetExamplesPanel";
import { CHILD_TYPE, TYPE_LABEL, canCreateChildOf, canModifyNode } from "./clientPermissions";
import type { ApiContextNode, NovaUser } from "./types";

const TYPE_STYLES: Record<ContextNodeType, { icon: typeof UniversoIcon; accent: string; ring: string }> = {
  UNIVERSO: { icon: UniversoIcon, accent: "text-luminous-primary-fixed-dim", ring: "border-luminous-primary/30 bg-luminous-primary/5" },
  GALAXIA: { icon: GalaxiaIcon, accent: "text-luminous-secondary", ring: "border-luminous-secondary/25 bg-luminous-secondary/5" },
  ESTRELA: { icon: EstrelaIcon, accent: "text-luminous-tertiary", ring: "border-luminous-tertiary/25 bg-luminous-tertiary/5" },
  PLANETA: { icon: PlanetaIcon, accent: "text-emerald-300", ring: "border-emerald-300/20 bg-emerald-300/5" },
};

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
}: Props) {
  const style = TYPE_STYLES[node.type];
  const Icon = style.icon;
  const isExpanded = expanded.has(node.id);
  const isPlaneta = node.type === "PLANETA";
  const hasChildren = node.children.length > 0;
  // Planeta não tem filhos na árvore, mas o "expandir" ainda serve pra
  // mostrar/esconder os exemplos de treino anexados a ele.
  const isExpandable = hasChildren || isPlaneta;
  const childType = CHILD_TYPE[node.type];
  const isUserGalaxy = node.type === "GALAXIA" && node.id === userGalaxyId;

  const canCreateChild = childType !== null && canCreateChildOf(node, user, userGalaxyId, byId);
  const canModify = canModifyNode(node, user, userGalaxyId, byId);

  return (
    <div className={depth > 0 ? "ml-5 border-l border-white/10 pl-4" : ""}>
      <div
        className={`flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2.5 ${style.ring} ${
          isUserGalaxy ? "ring-1 ring-luminous-primary/50" : ""
        }`}
      >
        <button
          type="button"
          onClick={() => onToggleExpanded(node.id)}
          disabled={!isExpandable}
          aria-label={isExpanded ? "Recolher" : isPlaneta ? "Ver exemplos de treino" : "Expandir"}
          title={isPlaneta ? "Exemplos de treino" : undefined}
          className={`grid h-6 w-6 shrink-0 place-items-center rounded-md transition ${
            isExpandable ? "hover:bg-white/10" : "opacity-0"
          }`}
        >
          <ChevronDownIcon className={`h-4 w-4 transition-transform ${isExpanded ? "" : "-rotate-90"}`} />
        </button>

        <Icon className={`h-4 w-4 shrink-0 ${style.accent}`} />

        <span className="min-w-0 truncate text-sm font-medium text-luminous-on-surface">{node.name}</span>

        <span className={`shrink-0 font-mono text-[10px] uppercase tracking-[0.1em] ${style.accent}`}>
          {TYPE_LABEL[node.type]}
        </span>

        {isUserGalaxy && <Badge variant="info">Sua Galáxia</Badge>}

        <div className="ml-auto flex shrink-0 items-center gap-1">
          {canCreateChild && childType && (
            <button
              type="button"
              onClick={() => onRequestCreate(childType, node.id)}
              aria-label={`Criar ${TYPE_LABEL[childType]}`}
              title={`+ ${TYPE_LABEL[childType]}`}
              className="grid h-7 w-7 place-items-center rounded-md border border-white/10 bg-white/5 hover:bg-white/10"
            >
              <PlusIcon className="h-3.5 w-3.5" />
            </button>
          )}
          {canModify && (
            <>
              <button
                type="button"
                onClick={() => onRequestEdit(node)}
                aria-label={`Editar ${node.name}`}
                title="Editar"
                className="grid h-7 w-7 place-items-center rounded-md border border-white/10 bg-white/5 hover:bg-white/10"
              >
                <EditIcon className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => onRequestDelete(node)}
                aria-label={`Excluir ${node.name}`}
                title="Excluir"
                className="grid h-7 w-7 place-items-center rounded-md border border-white/10 bg-white/5 text-luminous-error hover:bg-luminous-error/10"
              >
                <TrashIcon className="h-3.5 w-3.5" />
              </button>
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
            />
          ))}
        </div>
      )}

      {isExpanded && isPlaneta && (
        <div className="ml-5 mt-2 border-l border-white/10 pl-4">
          <PlanetExamplesPanel node={node} canManage={canModify} />
        </div>
      )}
    </div>
  );
}
