"use client";

import { useEffect, useRef, useState } from "react";
import { signOut } from "next-auth/react";

// Avatar do usuário no header: abre um menu com a opção de sair da conta.
export default function UserMenu({ initials = "PO" }: { initials?: string }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        aria-label="Menu do usuário"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="grid h-10 w-10 place-items-center rounded-full border border-luminous-primary/50 bg-luminous-primary-container font-mono text-xs"
      >
        {initials}
      </button>

      {open && (
        <div className="absolute right-0 top-12 z-10 w-40 overflow-hidden rounded-lg border border-white/10 bg-luminous-surface-container shadow-lg">
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="block w-full px-4 py-3 text-left text-sm text-luminous-on-surface hover:bg-white/5"
          >
            Logout
          </button>
        </div>
      )}
    </div>
  );
}
