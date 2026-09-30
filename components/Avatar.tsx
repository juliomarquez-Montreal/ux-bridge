// Avatar circular reutilizável: foto real do usuário (avatarUrl) ou
// iniciais como fallback — mesma lógica de components/UserMenu.tsx
// (getInitials), extraída aqui pra ser usada em qualquer lugar que precise
// mostrar "quem é" (ex: PO/UX no subheader do WireframeEditor).
export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase() || "?";
}

export default function Avatar({
  name,
  avatarUrl,
  size = 35,
  className = "",
}: {
  name: string;
  avatarUrl?: string | null;
  size?: number;
  className?: string;
}) {
  return (
    <div
      style={{ width: size, height: size }}
      className={`grid shrink-0 place-items-center overflow-hidden rounded-full border-2 border-white bg-[#d4d4d6] font-mono text-[11px] font-semibold text-[#3a3a3f] ${className}`}
      title={name}
    >
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- foto vem do Supabase Storage
        <img src={avatarUrl} alt={name} className="h-full w-full object-cover" />
      ) : (
        getInitials(name)
      )}
    </div>
  );
}
