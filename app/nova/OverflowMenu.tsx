"use client";

import { useEffect, useRef, useState } from "react";
import { MoreIcon } from "@/components/icons";

interface MenuItem {
  label: string;
  onClick: () => void;
  danger?: boolean;
}

// Menu "..." de ações adicionais numa linha da árvore (hoje só Excluir, mas
// deixa espaço pra outras ações futuras sem lotar a linha de ícones).
export default function OverflowMenu({ items, ariaLabel }: { items: MenuItem[]; ariaLabel: string }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={ariaLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        title="Mais ações"
        className="grid h-9 w-9 place-items-center rounded-md border border-white/10 bg-white/5 hover:bg-white/10"
      >
        <MoreIcon className="h-4 w-4" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-20 mt-1 w-40 overflow-hidden rounded-lg border border-white/10 bg-luminous-surface-container shadow-xl"
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                item.onClick();
              }}
              className={`block w-full px-3 py-2 text-left text-sm hover:bg-white/10 ${
                item.danger ? "text-luminous-error" : "text-luminous-on-surface"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
