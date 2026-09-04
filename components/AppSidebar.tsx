"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import {
  ActivityIcon,
  DocumentIcon,
  EyeIcon,
  FolderIcon,
  FrameIcon,
  GearIcon,
  GridIcon,
  LayersIcon,
  NovaIcon,
} from "@/components/icons";

interface NavItem {
  label: string;
  icon: (props: { className?: string }) => ReactNode;
  href?: string;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Visão geral", icon: EyeIcon },
  { label: "Dashboard", icon: GridIcon, href: "/" },
  { label: "NOVA", icon: NovaIcon, href: "/nova" },
  { label: "Atividades", icon: ActivityIcon },
  { label: "Projetos", icon: FolderIcon },
  { label: "Transcrições", icon: DocumentIcon },
  { label: "Protótipos", icon: LayersIcon },
  { label: "Wireframes", icon: FrameIcon },
  { label: "Configurações", icon: GearIcon, href: "/settings" },
];

export default function AppSidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname();

  return (
    <>
      {/* Backdrop: acima do header (que fica escondido atrás do sidebar), fecha ao clicar fora. */}
      <div
        aria-hidden="true"
        onClick={onClose}
        className={`fixed inset-0 z-[35] bg-black/60 backdrop-blur-[2px] transition-opacity duration-300 ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      <aside
        aria-hidden={!open}
        className={`fixed inset-y-0 left-0 z-40 w-72 border-r border-white/10 bg-luminous-surface-container/95 backdrop-blur-lg transition-transform duration-300 ease-out ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <span className="font-sora text-lg font-bold tracking-[0.08em]">UX·BRIDGE</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar menu"
            className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold uppercase tracking-[.05em] hover:bg-white/10"
          >
            <GridIcon className="h-4 w-4" />
            Menu
          </button>
        </div>

        <nav className="space-y-1 p-4">
          {NAV_ITEMS.map(({ label, icon: Icon, href }) => {
            const active = href && (href === "/" ? pathname === "/" : pathname.startsWith(href));
            const className = `flex items-center gap-3 rounded-lg px-4 py-2.5 text-sm transition ${
              active
                ? "bg-luminous-primary/15 text-luminous-primary-fixed-dim"
                : href
                  ? "text-luminous-on-surface-variant hover:bg-white/5 hover:text-luminous-on-surface"
                  : "cursor-default text-luminous-on-surface-variant/50"
            }`;

            if (!href) {
              return (
                <div key={label} className={className}>
                  <Icon className="h-5 w-5 shrink-0" />
                  {label}
                </div>
              );
            }

            return (
              <a key={label} href={href} onClick={onClose} className={className}>
                <Icon className="h-5 w-5 shrink-0" />
                {label}
              </a>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
