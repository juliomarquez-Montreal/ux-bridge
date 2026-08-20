// Fundo SVG sem imagens externas, com movimento lento e não intrusivo.
export default function AbstractBackground() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-[#0D0D0D]">
      <svg viewBox="0 0 1440 900" className="h-full w-full" preserveAspectRatio="xMidYMid slice">
        <defs>
          <radialGradient id="violetGlow"><stop stopColor="#9457DF" stopOpacity=".32" /><stop offset="1" stopColor="#15121a" stopOpacity="0" /></radialGradient>
          <linearGradient id="slateGlow" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#3c3740" stopOpacity=".6" /><stop offset="1" stopColor="#1e1a22" stopOpacity="0" /></linearGradient>
          <filter id="softBlur"><feGaussianBlur stdDeviation="18" /></filter>
        </defs>
        <rect width="1440" height="900" fill="#15121a" />
        <circle className="float-slow" cx="225" cy="180" r="350" fill="url(#violetGlow)" filter="url(#softBlur)" />
        <circle className="float-reverse" cx="1180" cy="670" r="390" fill="url(#slateGlow)" filter="url(#softBlur)" />
        <g className="float-reverse" fill="none" stroke="#d9b9ff" strokeOpacity=".17">
          <rect x="1020" y="92" width="220" height="220" rx="20" strokeWidth="2" />
          <rect x="1060" y="132" width="140" height="140" rx="12" strokeWidth="1" />
        </g>
        <g className="drift-line" stroke="#cec2d5" strokeOpacity=".14" fill="none">
          <path d="M-80 690 C280 500 520 820 850 600 S1330 520 1520 730" strokeWidth="1" />
          <path d="M-100 712 C300 522 540 842 870 622 S1350 542 1540 752" strokeWidth="1" strokeDasharray="5 11" />
        </g>
      </svg>
      <div className="pixel-grid absolute inset-0 opacity-60" />
    </div>
  );
}
