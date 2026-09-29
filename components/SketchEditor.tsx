"use client";

import { useState } from "react";
import type { ApiBridge, SketchBlock, SketchData, SketchHeightHint, SketchWidthHint, SketchZone } from "@/app/bridges/types";
import { CloseIcon, GripIcon, PlusIcon, TrashIcon } from "@/components/icons";
import PillButton from "@/components/PillButton";

// Editor visual manual do Sketch (Bridge-3b) — estilo Canva/Figma
// simplificado: os mesmos blocos do SketchPreview (zone/row/order/
// widthHint/heightHint), mas arrastáveis, editáveis e com controles diretos,
// como alternativa a "Rejeitar e comentar". Genérico pra qualquer estrutura
// de Sketch — nada aqui é específico de um Tipo de Planeta.

interface EditableBlock extends SketchBlock {
  id: string;
}

function makeId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `b${Math.random().toString(36).slice(2)}`;
}

function toEditableBlocks(sketchData: SketchData | null): EditableBlock[] {
  const blocks = Array.isArray(sketchData?.blocks) ? sketchData.blocks : [];
  return blocks.map((block) => ({ ...block, id: makeId() }));
}

// Reatribui "order" 0..n-1 dentro de cada grupo zone(+row, se content), na
// ordem em que aparecem no array — toda operação de mover/adicionar/remover
// reconstrói o array na ordem visual desejada e chama isso no final.
function renumberOrders(blocks: EditableBlock[]): EditableBlock[] {
  const counters = new Map<string, number>();
  return blocks.map((block) => {
    const key = block.zone === "content" ? `content:${block.row}` : block.zone;
    const next = counters.get(key) ?? 0;
    counters.set(key, next + 1);
    return { ...block, order: next };
  });
}

function contentRowKeys(blocks: EditableBlock[]): number[] {
  const rows = new Set<number>();
  for (const block of blocks) if (block.zone === "content") rows.add(block.row);
  return Array.from(rows).sort((a, b) => a - b);
}

const ZONE_LABEL: Record<SketchZone, string> = { header: "Header", sidebar: "Sidebar", content: "Conteúdo", footer: "Footer" };

export default function SketchEditor({
  bridgeId,
  initialSketchData,
  onClose,
  onSaved,
}: {
  bridgeId: string;
  initialSketchData: SketchData | null;
  onClose: () => void;
  onSaved: (bridge: ApiBridge) => void;
}) {
  const [blocks, setBlocks] = useState<EditableBlock[]>(() => renumberOrders(toEditableBlocks(initialSketchData)));
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newZone, setNewZone] = useState<SketchZone>("content");
  const [newWidthHint, setNewWidthHint] = useState<SketchWidthHint>("fill");
  const [newHeightHint, setNewHeightHint] = useState<SketchHeightHint>("compact");
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Move o bloco arrastado pra imediatamente antes de `targetId`, adotando a
  // zone+row do alvo — um único primitivo cobre reordenar dentro da mesma
  // linha E mover entre linhas/zonas (é só uma questão de qual é o alvo).
  function moveBeforeBlock(targetId: string) {
    if (!draggedId || draggedId === targetId) return;
    setBlocks((prev) => {
      const dragged = prev.find((b) => b.id === draggedId);
      const target = prev.find((b) => b.id === targetId);
      if (!dragged || !target) return prev;
      const updatedDragged: EditableBlock = { ...dragged, zone: target.zone, row: target.zone === "content" ? target.row : 0 };
      const withoutDragged = prev.filter((b) => b.id !== draggedId);
      const targetIndex = withoutDragged.findIndex((b) => b.id === targetId);
      const next = [...withoutDragged.slice(0, targetIndex), updatedDragged, ...withoutDragged.slice(targetIndex)];
      return renumberOrders(next);
    });
    setDraggedId(null);
  }

  // Solto na área vazia de uma linha/zona (não em cima de um bloco
  // específico) — entra no final dela.
  function moveToEndOfZone(zone: SketchZone, row: number) {
    if (!draggedId) return;
    setBlocks((prev) => {
      const dragged = prev.find((b) => b.id === draggedId);
      if (!dragged) return prev;
      const updatedDragged: EditableBlock = { ...dragged, zone, row: zone === "content" ? row : 0 };
      const withoutDragged = prev.filter((b) => b.id !== draggedId);
      return renumberOrders([...withoutDragged, updatedDragged]);
    });
    setDraggedId(null);
  }

  // Solto na faixa entre duas linhas de conteúdo — cria uma linha nova ali,
  // empurrando as linhas seguintes pra baixo.
  function moveToNewContentRow(insertAtPosition: number) {
    if (!draggedId) return;
    setBlocks((prev) => {
      const dragged = prev.find((b) => b.id === draggedId);
      if (!dragged) return prev;
      const withoutDragged = prev.filter((b) => b.id !== draggedId);
      const shifted = withoutDragged.map((b) =>
        b.zone === "content" && b.row >= insertAtPosition ? { ...b, row: b.row + 1 } : b
      );
      const updatedDragged: EditableBlock = { ...dragged, zone: "content", row: insertAtPosition };
      return renumberOrders([...shifted, updatedDragged]);
    });
    setDraggedId(null);
  }

  function updateBlock(id: string, patch: Partial<SketchBlock>) {
    setBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  }

  function removeBlock(id: string) {
    setBlocks((prev) => renumberOrders(prev.filter((b) => b.id !== id)));
  }

  function handleAddBlock() {
    if (!newLabel.trim()) return;
    setBlocks((prev) => {
      const row = newZone === "content" ? Math.max(-1, ...contentRowKeys(prev)) + 1 : 0;
      const block: EditableBlock = {
        id: makeId(),
        label: newLabel.trim(),
        zone: newZone,
        row,
        order: 0,
        widthHint: newWidthHint,
        heightHint: newZone === "header" || newZone === "footer" ? "compact" : newHeightHint,
      };
      return renumberOrders([...prev, block]);
    });
    setNewLabel("");
    setAddOpen(false);
  }

  async function handleSave(approve: boolean) {
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(`/api/bridges/${bridgeId}/sketch-edit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          approve,
          blocks: blocks.map(({ id: _id, ...block }) => block),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Falha ao salvar o sketch.");
      onSaved(data.bridge);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Falha ao salvar o sketch.");
      setConfirming(false);
    } finally {
      setSaving(false);
    }
  }

  const header = blocks.filter((b) => b.zone === "header");
  const sidebar = blocks.filter((b) => b.zone === "sidebar");
  const footer = blocks.filter((b) => b.zone === "footer");
  const content = blocks.filter((b) => b.zone === "content");
  const rowKeys = contentRowKeys(blocks);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-white/10 bg-luminous-surface-container shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <div>
            <h2 className="font-sora text-lg font-semibold text-white">Editar Sketch manualmente</h2>
            <p className="mt-0.5 text-xs text-luminous-on-surface-variant">
              Arraste os blocos pra reorganizar, edite o texto direto, ou use os controles de cada bloco.
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar" className="text-luminous-on-surface-variant hover:text-luminous-on-surface">
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {header.length > 0 && (
            <div className="mb-3">
              <ZoneRow
                blocks={header}
                draggedId={draggedId}
                onDragStart={setDraggedId}
                onDragEnd={() => setDraggedId(null)}
                onDropOnBlock={moveBeforeBlock}
                onDropOnZone={() => moveToEndOfZone("header", 0)}
                onUpdate={updateBlock}
                onRemove={removeBlock}
              />
            </div>
          )}

          <div className="flex gap-4">
            {sidebar.length > 0 && (
              <div className="w-[220px] shrink-0">
                <ZoneColumn
                  blocks={sidebar}
                  draggedId={draggedId}
                  onDragStart={setDraggedId}
                  onDragEnd={() => setDraggedId(null)}
                  onDropOnBlock={moveBeforeBlock}
                  onDropOnZone={() => moveToEndOfZone("sidebar", 0)}
                  onUpdate={updateBlock}
                  onRemove={removeBlock}
                />
              </div>
            )}

            <div className="flex flex-1 flex-col">
              <DropStrip onDrop={() => moveToNewContentRow(0)} />
              {rowKeys.length === 0 && (
                <p className="rounded-lg border border-dashed border-white/15 px-4 py-6 text-center text-sm text-luminous-on-surface-variant">
                  Nenhum bloco de conteúdo — use &quot;+ Adicionar bloco&quot; abaixo.
                </p>
              )}
              {rowKeys.map((rowKey, index) => (
                <div key={rowKey}>
                  <ZoneRow
                    blocks={content.filter((b) => b.row === rowKey)}
                    draggedId={draggedId}
                    onDragStart={setDraggedId}
                    onDragEnd={() => setDraggedId(null)}
                    onDropOnBlock={moveBeforeBlock}
                    onDropOnZone={() => moveToEndOfZone("content", rowKey)}
                    onUpdate={updateBlock}
                    onRemove={removeBlock}
                  />
                  <DropStrip onDrop={() => moveToNewContentRow(index + 1)} />
                </div>
              ))}
            </div>
          </div>

          {footer.length > 0 && (
            <div className="mt-3">
              <ZoneRow
                blocks={footer}
                draggedId={draggedId}
                onDragStart={setDraggedId}
                onDragEnd={() => setDraggedId(null)}
                onDropOnBlock={moveBeforeBlock}
                onDropOnZone={() => moveToEndOfZone("footer", 0)}
                onUpdate={updateBlock}
                onRemove={removeBlock}
              />
            </div>
          )}

          <div className="mt-4">
            {!addOpen ? (
              <PillButton type="button" variant="inactive" onClick={() => setAddOpen(true)}>
                <span className="flex items-center gap-1.5">
                  <PlusIcon className="h-3.5 w-3.5" /> Adicionar bloco
                </span>
              </PillButton>
            ) : (
              <div className="space-y-2 rounded-lg border border-white/10 bg-black/20 p-3">
                <input
                  type="text"
                  value={newLabel}
                  onChange={(event) => setNewLabel(event.target.value)}
                  placeholder="Nome do componente..."
                  autoFocus
                  className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none focus:border-luminous-primary"
                />
                <div className="flex flex-wrap gap-2">
                  <select
                    value={newZone}
                    onChange={(event) => setNewZone(event.target.value as SketchZone)}
                    style={{ colorScheme: "dark" }}
                    className="rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-xs"
                  >
                    {(Object.keys(ZONE_LABEL) as SketchZone[]).map((zone) => (
                      <option key={zone} value={zone} className="bg-luminous-surface-container">
                        {ZONE_LABEL[zone]}
                      </option>
                    ))}
                  </select>
                  <select
                    value={newWidthHint}
                    onChange={(event) => setNewWidthHint(event.target.value as SketchWidthHint)}
                    style={{ colorScheme: "dark" }}
                    className="rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-xs"
                  >
                    <option value="fill" className="bg-luminous-surface-container">Largura: Preencher</option>
                    <option value="auto" className="bg-luminous-surface-container">Largura: Compacta</option>
                  </select>
                  {newZone !== "header" && newZone !== "footer" && (
                    <select
                      value={newHeightHint}
                      onChange={(event) => setNewHeightHint(event.target.value as SketchHeightHint)}
                      style={{ colorScheme: "dark" }}
                      className="rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-xs"
                    >
                      <option value="compact" className="bg-luminous-surface-container">Altura: Compacta</option>
                      <option value="fill" className="bg-luminous-surface-container">Altura: Preencher</option>
                    </select>
                  )}
                </div>
                <div className="flex justify-end gap-2">
                  <PillButton
                    type="button"
                    variant="inactive"
                    onClick={() => {
                      setAddOpen(false);
                      setNewLabel("");
                    }}
                  >
                    Cancelar
                  </PillButton>
                  <PillButton type="button" variant="primary" onClick={handleAddBlock} disabled={!newLabel.trim()}>
                    Adicionar
                  </PillButton>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-white/10 px-6 py-4">
          {saveError && <p className="mb-3 text-sm text-luminous-error">{saveError}</p>}
          {!confirming ? (
            <div className="flex justify-end gap-2">
              <PillButton type="button" variant="inactive" onClick={onClose} disabled={saving}>
                Cancelar
              </PillButton>
              <PillButton type="button" variant="primary" onClick={() => setConfirming(true)} disabled={saving || blocks.length === 0}>
                Salvar
              </PillButton>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-luminous-on-surface">Considera este Sketch aprovado?</p>
              <div className="flex flex-wrap gap-2">
                <PillButton type="button" variant="inactive" onClick={() => setConfirming(false)} disabled={saving}>
                  Voltar a editar
                </PillButton>
                <PillButton type="button" variant="inactive" onClick={() => handleSave(false)} disabled={saving}>
                  {saving ? "Salvando..." : "Não, quero revisar mais"}
                </PillButton>
                <PillButton type="button" variant="primary" onClick={() => handleSave(true)} disabled={saving}>
                  {saving ? "Salvando..." : "Sim, aprovar"}
                </PillButton>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function EditableBlockCard({
  block,
  draggedId,
  onDragStart,
  onDragEnd,
  onDropOnBlock,
  onUpdate,
  onRemove,
  fill,
}: {
  block: EditableBlock;
  draggedId: string | null;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
  onDropOnBlock: (id: string) => void;
  onUpdate: (id: string, patch: Partial<SketchBlock>) => void;
  onRemove: (id: string) => void;
  fill?: boolean;
}) {
  const canToggleHeight = block.zone !== "header" && block.zone !== "footer";
  return (
    <div
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData("text/plain", block.id);
        onDragStart(block.id);
      }}
      onDragEnd={onDragEnd}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onDropOnBlock(block.id);
      }}
      className={`flex cursor-grab flex-col gap-1.5 rounded-md border-2 border-dashed p-2 active:cursor-grabbing ${
        draggedId === block.id ? "border-luminous-primary bg-luminous-primary/10 opacity-50" : "border-white/25 bg-white/5"
      } ${fill ? "flex-1" : "w-44 shrink-0"} ${block.heightHint === "fill" ? "min-h-[160px]" : ""}`}
    >
      <div className="flex items-center gap-1">
        <GripIcon className="h-3.5 w-3.5 shrink-0 text-white/30" />
        <input
          value={block.label}
          onChange={(event) => onUpdate(block.id, { label: event.target.value })}
          onClick={(event) => event.stopPropagation()}
          className="min-w-0 flex-1 bg-transparent text-[11px] font-mono text-luminous-on-surface outline-none"
        />
        <button
          type="button"
          onClick={() => onRemove(block.id)}
          aria-label={`Remover bloco ${block.label}`}
          className="shrink-0 text-luminous-error/70 hover:text-luminous-error"
        >
          <TrashIcon className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="flex flex-wrap gap-1">
        <button
          type="button"
          onClick={() => onUpdate(block.id, { widthHint: block.widthHint === "fill" ? "auto" : "fill" })}
          className="rounded border border-white/10 px-1.5 py-0.5 font-mono text-[9px] uppercase text-luminous-on-surface-variant hover:text-luminous-on-surface"
        >
          L: {block.widthHint === "fill" ? "preencher" : "compacta"}
        </button>
        {canToggleHeight && (
          <button
            type="button"
            onClick={() => onUpdate(block.id, { heightHint: block.heightHint === "fill" ? "compact" : "fill" })}
            className="rounded border border-white/10 px-1.5 py-0.5 font-mono text-[9px] uppercase text-luminous-on-surface-variant hover:text-luminous-on-surface"
          >
            A: {block.heightHint === "fill" ? "preencher" : "compacta"}
          </button>
        )}
        <select
          value={block.zone}
          onChange={(event) => {
            const zone = event.target.value as SketchZone;
            onUpdate(block.id, { zone, row: zone === "content" ? block.row : 0 });
          }}
          onClick={(event) => event.stopPropagation()}
          style={{ colorScheme: "dark" }}
          className="rounded border border-white/10 bg-transparent px-1 py-0.5 font-mono text-[9px] uppercase text-luminous-on-surface-variant"
        >
          {(Object.keys(ZONE_LABEL) as SketchZone[]).map((zone) => (
            <option key={zone} value={zone} className="bg-luminous-surface-container">
              {ZONE_LABEL[zone]}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

function ZoneRow({
  blocks,
  draggedId,
  onDragStart,
  onDragEnd,
  onDropOnBlock,
  onDropOnZone,
  onUpdate,
  onRemove,
}: {
  blocks: EditableBlock[];
  draggedId: string | null;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
  onDropOnBlock: (id: string) => void;
  onDropOnZone: () => void;
  onUpdate: (id: string, patch: Partial<SketchBlock>) => void;
  onRemove: (id: string) => void;
}) {
  const sorted = [...blocks].sort((a, b) => a.order - b.order);
  return (
    <div
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        onDropOnZone();
      }}
      className="flex min-h-[64px] items-stretch gap-3 rounded-lg p-1"
    >
      {sorted.map((block) => (
        <EditableBlockCard
          key={block.id}
          block={block}
          draggedId={draggedId}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          onDropOnBlock={onDropOnBlock}
          onUpdate={onUpdate}
          onRemove={onRemove}
          fill={block.widthHint === "fill"}
        />
      ))}
    </div>
  );
}

function ZoneColumn({
  blocks,
  draggedId,
  onDragStart,
  onDragEnd,
  onDropOnBlock,
  onDropOnZone,
  onUpdate,
  onRemove,
}: {
  blocks: EditableBlock[];
  draggedId: string | null;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
  onDropOnBlock: (id: string) => void;
  onDropOnZone: () => void;
  onUpdate: (id: string, patch: Partial<SketchBlock>) => void;
  onRemove: (id: string) => void;
}) {
  const sorted = [...blocks].sort((a, b) => a.order - b.order);
  return (
    <div
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        onDropOnZone();
      }}
      className="flex flex-col gap-3 rounded-lg p-1"
    >
      {sorted.map((block) => (
        <EditableBlockCard
          key={block.id}
          block={block}
          draggedId={draggedId}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          onDropOnBlock={onDropOnBlock}
          onUpdate={onUpdate}
          onRemove={onRemove}
        />
      ))}
    </div>
  );
}

function DropStrip({ onDrop }: { onDrop: () => void }) {
  const [hover, setHover] = useState(false);
  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        setHover(true);
      }}
      onDragLeave={() => setHover(false)}
      onDrop={(event) => {
        event.preventDefault();
        setHover(false);
        onDrop();
      }}
      className={`my-1 rounded transition-all ${hover ? "h-6 border border-dashed border-luminous-primary/50 bg-luminous-primary/20" : "h-2"}`}
    />
  );
}
