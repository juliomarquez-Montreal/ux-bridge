"use client";

import { useState } from "react";
import { CloseIcon } from "@/components/icons";

export interface LinkModalItem {
  id: string;
  label: string;
  sublabel?: string;
  linked: boolean;
  // true quando o usuário não tem permissão pra alternar este item específico
  // (ex: uma Galáxia que não é a dele, e ele não é ADMIN).
  disabled?: boolean;
}

interface Props {
  title: string;
  description?: string;
  items: LinkModalItem[];
  emptyMessage: string;
  onToggle: (itemId: string, nextLinked: boolean) => Promise<void>;
  onClose: () => void;
}

// Modal genérico de "marcar quais itens vincular" — reutilizado nas duas
// direções do N:N Design System <-> Galáxia: a partir de uma Galáxia
// (marcando quais fontes vincular a ela) ou a partir de uma fonte (marcando
// quais Galáxias devem recebê-la). Cada toggle chama a API na hora; a lista
// de `items` já vem com o estado `linked` atualizado do componente pai.
export default function DesignSystemLinkModal({ title, description, items, emptyMessage, onToggle, onClose }: Props) {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function handleToggle(item: LinkModalItem) {
    setPendingId(item.id);
    setErrors((prev) => {
      const next = { ...prev };
      delete next[item.id];
      return next;
    });
    try {
      await onToggle(item.id, !item.linked);
    } catch (err) {
      setErrors((prev) => ({ ...prev, [item.id]: err instanceof Error ? err.message : "Falha ao salvar." }));
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-black/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        className="max-h-[80vh] w-full max-w-md overflow-y-auto rounded-xl border border-white/10 bg-luminous-surface-container p-6 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-1 flex items-center justify-between">
          <h2 className="font-sora text-lg font-semibold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="text-luminous-on-surface-variant hover:text-luminous-on-surface"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>
        {description && <p className="mb-4 text-xs text-luminous-on-surface-variant">{description}</p>}

        {items.length === 0 ? (
          <p className="mt-3 text-sm text-luminous-on-surface-variant">{emptyMessage}</p>
        ) : (
          <ul className="mt-3 space-y-1.5">
            {items.map((item) => (
              <li key={item.id}>
                <label
                  className={`flex items-center gap-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 ${
                    item.disabled ? "opacity-50" : "cursor-pointer hover:bg-white/10"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={item.linked}
                    disabled={item.disabled || pendingId === item.id}
                    onChange={() => handleToggle(item)}
                    className="h-4 w-4 shrink-0 accent-luminous-primary"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-luminous-on-surface">{item.label}</span>
                    {item.sublabel && (
                      <span className="block truncate text-xs text-luminous-on-surface-variant">{item.sublabel}</span>
                    )}
                  </span>
                  {pendingId === item.id && (
                    <span className="shrink-0 text-xs text-luminous-on-surface-variant">Salvando...</span>
                  )}
                </label>
                {errors[item.id] && <p className="mt-1 pl-3 text-xs text-luminous-error">{errors[item.id]}</p>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
