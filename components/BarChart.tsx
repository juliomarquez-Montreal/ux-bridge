export interface BarChartItem {
  label: string;
  count: number;
}

// Barras com dados reais; o pico (maior contagem) ganha o destaque azul
// (tertiary), quebrando a monotonia roxa. Contagem 0 vira uma barrinha mínima.
export default function BarChart({ items, ariaLabel }: { items: BarChartItem[]; ariaLabel: string }) {
  const max = Math.max(0, ...items.map((i) => i.count));
  const peak = max > 0 ? items.findIndex((i) => i.count === max) : -1;
  return (
    <div aria-label={ariaLabel} role="img" className="flex h-20 items-end gap-2">
      {items.map((item, index) => (
        <div
          key={item.label}
          title={`${item.label}: ${item.count} Bridge(s)`}
          style={{ height: `${max === 0 ? 6 : Math.max(6, (item.count / max) * 100)}%` }}
          className={`flex-1 rounded-t-sm transition-[height] duration-500 ${index === peak ? "bg-luminous-tertiary shadow-[0_0_16px_rgba(0,119,255,.5)]" : "bg-white/15"}`}
        />
      ))}
    </div>
  );
}
