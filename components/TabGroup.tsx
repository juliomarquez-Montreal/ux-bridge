"use client";

type Props = { tabs: string[]; activeTab: string; onTabChange?: (tab: string) => void };
// Grupo de abas controlável, com fallback visual para o estado inicial.
export default function TabGroup({ tabs, activeTab, onTabChange }: Props) {
  return <div className="flex rounded-full bg-black/35 p-1">{tabs.map((tab) => <button key={tab} onClick={() => onTabChange?.(tab)} className={`flex-1 rounded-full px-3 py-2 font-inter text-sm transition ${tab === activeTab ? "bg-luminous-primary text-luminous-on-primary" : "text-luminous-on-surface-variant hover:text-luminous-on-surface"}`}>{tab}</button>)}</div>;
}
