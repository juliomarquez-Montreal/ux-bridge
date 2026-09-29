// Indicador de progresso pra qualquer tela aguardando uma geração de IA
// (BDD ou Sketch) — a duração real da chamada é desconhecida, então a barra
// é indeterminada (só comunica "em andamento", nunca uma porcentagem real).
export default function GeneratingProgress({ label }: { label: string }) {
  return (
    <div>
      <p className="text-sm text-luminous-on-surface">{label}</p>
      <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
        <div className="progress-bar-indeterminate h-full w-1/3 rounded-full bg-luminous-primary" />
      </div>
      <p className="mt-3 text-xs text-luminous-on-surface-variant">
        Você pode fechar esta janela — a geração continua em segundo plano. Acompanhe o progresso em /bridges.
      </p>
    </div>
  );
}
