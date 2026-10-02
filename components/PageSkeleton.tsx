import Skeleton from "@/components/Skeleton";

// Placeholder de página inteira enquanto os dados carregam (no lugar do texto
// estático "Carregando..."). A barra azul global (NavigationProgress) indica o
// progresso; isto só segura o espaço do layout.
export default function PageSkeleton({ rows = 4, tone = "dark" }: { rows?: number; tone?: "dark" | "light" }) {
  return (
    <div className="mt-6 space-y-3" role="status" aria-label="Carregando">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} tone={tone} className={`h-12 rounded-lg ${i === 0 ? "w-2/3" : "w-full"}`} />
      ))}
    </div>
  );
}
