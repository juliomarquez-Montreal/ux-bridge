"use client";

import { useEffect, useRef, useState } from "react";
import UserMenu from "@/components/UserMenu";
import AppSidebar from "@/components/AppSidebar";
import SearchPalette from "@/components/SearchPalette";
import { BellIcon, GearIcon, GridIcon, PlusIcon, SearchIcon } from "@/components/icons";

// Header/navegação compartilhado entre as páginas autenticadas (dashboard,
// ajustes, etc.). Sticky no topo; dono do estado do sidebar e da busca —
// ambos são renderizados aqui como irmãos do <header>, não aninhados nele
// (ver components/SearchPalette.tsx pro motivo).
export default function AppHeader() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [isMac, setIsMac] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setIsMac(typeof navigator !== "undefined" && /mac/i.test(navigator.platform ?? navigator.userAgent));
  }, []);

  function openSearch() {
    setSidebarOpen(false);
    setSearchOpen(true);
  }

  function closeSearch() {
    setSearchOpen(false);
  }

  function toggleSidebar() {
    setSearchOpen(false);
    setSidebarOpen((v) => !v);
  }

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const isShortcut = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k";
      if (isShortcut) {
        event.preventDefault();
        setSidebarOpen(false);
        setSearchOpen(true);
        searchInputRef.current?.focus();
        return;
      }
      if (event.key === "Escape") {
        setSearchOpen(false);
        setSidebarOpen(false);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-luminous-outline-variant/70 bg-luminous-surface/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center gap-3 px-6 py-3 lg:px-8">
          <span className="font-sora text-lg font-bold tracking-[0.08em]">UX·BRIDGE</span>

          <button
            type="button"
            onClick={toggleSidebar}
            aria-expanded={sidebarOpen}
            className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold uppercase tracking-[.05em] hover:bg-white/10"
          >
            <GridIcon className="h-4 w-4" />
            Menu
          </button>

          <div className="hidden items-center gap-1.5 text-sm text-luminous-on-surface-variant sm:flex">
            <span>Redesign Core</span>
            <span>/</span>
            <span>Squad Alpha</span>
          </div>

          <div className="relative order-last w-full sm:order-none sm:ml-2 sm:w-auto sm:flex-1 sm:max-w-md">
            <div className="flex items-center gap-2 rounded-full border border-white/10 bg-luminous-surface-container/70 px-4 py-2 text-sm">
              <SearchIcon className="h-4 w-4 shrink-0 text-luminous-on-surface-variant" />
              <input
                ref={searchInputRef}
                type="text"
                readOnly
                onFocus={openSearch}
                onClick={openSearch}
                placeholder="O que você precisa encontrar?"
                className="w-full min-w-0 flex-1 cursor-pointer bg-transparent text-luminous-on-surface outline-none placeholder:text-luminous-on-surface-variant"
              />
              <kbd className="hidden shrink-0 rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-luminous-on-surface-variant sm:block">
                {isMac ? "⌘K" : "Ctrl K"}
              </kbd>
            </div>

            {searchOpen && <SearchPalette onClose={closeSearch} />}
          </div>

          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              aria-label="Criar novo"
              // TODO: ligar no fluxo real de criação (transcrição/PBI/etc.) quando o
              // pipeline de criação de transcrição existir. Por enquanto é só visual.
              className="flex items-center gap-1.5 rounded-full bg-luminous-primary px-4 py-2 text-xs font-semibold uppercase tracking-[.05em] text-luminous-on-primary hover:bg-luminous-primary-fixed"
            >
              <PlusIcon className="h-4 w-4" />
              Criar novo
            </button>

            <button
              type="button"
              aria-label="Notificações"
              // TODO: ligar em notificações reais quando existirem.
              className="grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-white/5 hover:bg-white/10"
            >
              <BellIcon className="h-5 w-5" />
            </button>

            <a
              href="/settings"
              aria-label="Configurações"
              className="grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-white/5 hover:bg-white/10"
            >
              <GearIcon className="h-5 w-5" />
            </a>

            <UserMenu />
          </div>
        </div>
      </header>

      {searchOpen && (
        <div
          aria-hidden="true"
          onClick={closeSearch}
          className="fixed inset-0 z-20 bg-black/40 backdrop-blur-sm"
        />
      )}

      <AppSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
    </>
  );
}
