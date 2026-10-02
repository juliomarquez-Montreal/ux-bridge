const RELATIVE = new Intl.RelativeTimeFormat("pt-BR", { numeric: "auto" });

// "agora mesmo", "há 5 minutos", "há 2 horas", "ontem"... (passando de ~30
// dias, mostra a data).
export function relativeTime(iso: string): string {
  const diffSeconds = Math.round((new Date(iso).getTime() - Date.now()) / 1000);
  const abs = Math.abs(diffSeconds);
  if (abs < 45) return "agora mesmo";
  if (abs < 3600) return RELATIVE.format(Math.round(diffSeconds / 60), "minute");
  if (abs < 86400) return RELATIVE.format(Math.round(diffSeconds / 3600), "hour");
  if (abs < 86400 * 30) return RELATIVE.format(Math.round(diffSeconds / 86400), "day");
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}
