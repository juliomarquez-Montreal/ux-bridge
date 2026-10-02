export interface LineChartPoint {
  label: string;
  value: number | null;
  tooltip: string;
}

const WIDTH = 420;
const HEIGHT = 130;
const TOP = 18;
const BOTTOM = 108;

// Gráfico de linha em SVG com dados reais: um ponto por mês (valores null =
// mês sem dados, ficam de fora da linha). Valor maior = mais alto ("Lento");
// o último ponto com dado é destacado em azul (tertiary).
export default function LineChart({ points, ariaLabel }: { points: LineChartPoint[]; ariaLabel: string }) {
  const withData = points.map((p, i) => ({ ...p, i })).filter((p) => p.value !== null) as (LineChartPoint & { i: number; value: number })[];
  const max = Math.max(0, ...withData.map((p) => p.value));
  const x = (i: number) => 14 + (i * (WIDTH - 28)) / Math.max(1, points.length - 1);
  const y = (v: number) => (max === 0 ? BOTTOM : BOTTOM - (v / max) * (BOTTOM - TOP));
  const coords = withData.map((p) => ({ ...p, cx: x(p.i), cy: y(p.value) }));
  const line = coords.map((c, k) => `${k === 0 ? "M" : "L"}${c.cx} ${c.cy}`).join(" ");
  const last = coords[coords.length - 1];

  return (
    <svg aria-label={ariaLabel} role="img" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="h-full min-h-32 w-full">
      <defs>
        <linearGradient id="area" x1="0" x2="0" y1="0" y2="1">
          <stop stopColor="#9457DF" stopOpacity=".35" />
          <stop offset="1" stopColor="#9457DF" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`M0 ${BOTTOM}H${WIDTH}`} stroke="#978d9e" strokeOpacity=".25" strokeDasharray="4 7" />
      {coords.length > 1 && <path d={`${line} V${HEIGHT} H${coords[0].cx}Z`} fill="url(#area)" />}
      {coords.length > 1 && <path d={line} fill="none" stroke="#d8baf9" strokeWidth="2" className="animate-[fadeIn_0.6s_ease-out]" />}
      {coords.map((c) => (
        <g key={c.i}>
          <circle cx={c.cx} cy={c.cy} r={c === last ? 5 : 3.5} fill={c === last ? "#0077ff" : "#d8baf9"} />
          {c === last && <circle cx={c.cx} cy={c.cy} r="10" fill="#0077ff" fillOpacity=".18" />}
          <title>{c.tooltip}</title>
        </g>
      ))}
      {coords.length === 0 && (
        <text x={WIDTH / 2} y={HEIGHT / 2} textAnchor="middle" fill="#cec2d5" fontSize="12">
          Sem Bridge Specs aprovados neste recorte
        </text>
      )}
    </svg>
  );
}
