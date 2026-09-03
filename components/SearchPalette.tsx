"use client";

import type { ReactNode } from "react";
import { CheckCircleIcon, DocumentPlusIcon, LayersIcon } from "@/components/icons";

interface QuickItem {
  title: string;
  subtitle: string;
  icon: (props: { className?: string }) => ReactNode;
}

// Itens mockados — futuramente vêm de transcrições/PBIs/protótipos reais do usuário.
const QUICK_ITEMS: QuickItem[] = [
  { title: "Nova transcrição", subtitle: "Transcrições", icon: DocumentPlusIcon },
  { title: "PBIs recentes", subtitle: "Produto", icon: LayersIcon },
  { title: "Protótipos em revisão", subtitle: "Design", icon: LayersIcon },
  { title: "Wireframes aprovados", subtitle: "Design", icon: CheckCircleIcon },
];

// Dropdown de resultados. No mobile o gatilho é só um ícone (sem barra pra
// ancorar embaixo), então aqui vira `fixed` com margens fixas nas laterais
// pra nunca estourar a largura da tela; a partir de `sm` volta a ser
// ancorado logo abaixo da barra de busca (o pai precisa ter `position:
// relative`). O backdrop com blur é renderizado à parte, direto no
// AppHeader — como irmão do <header>, não aninhado nele, pra não escurecer
// o próprio header (ver nota de stacking context lá).
export default function SearchPalette({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-x-4 top-16 z-30 overflow-hidden rounded-2xl border border-white/10 bg-luminous-surface-container shadow-2xl sm:absolute sm:inset-x-0 sm:top-full sm:mt-2">
      <p className="px-5 pt-4 text-xs font-semibold uppercase tracking-[.1em] text-luminous-on-surface-variant">
        Acesso rápido
      </p>
      <ul className="p-2">
        {QUICK_ITEMS.map(({ title, subtitle, icon: Icon }) => (
          <li key={title}>
            <button
              type="button"
              onClick={onClose}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-white/5"
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-luminous-primary/15 text-luminous-primary">
                <Icon className="h-[18px] w-[18px]" />
              </span>
              <span>
                <span className="block text-sm text-luminous-on-surface">{title}</span>
                <span className="block text-xs text-luminous-on-surface-variant">{subtitle}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
