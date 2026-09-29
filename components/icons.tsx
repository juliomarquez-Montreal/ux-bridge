import type { SVGProps } from "react";
import {
  AlertTriangle,
  ArrowUpDown,
  Atom,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Filter,
  Globe,
  GripVertical,
  Link2,
  Network,
  Package,
  Pencil,
  Settings,
  Star,
  Trash2,
  X,
} from "lucide-react";

// Ícones de contorno simples, mesmo estilo dos usados em app/login/page.tsx
// (stroke fino, sem preenchimento), pra manter tudo consistente sem depender
// de uma biblioteca externa.

function base(props: SVGProps<SVGSVGElement>) {
  return { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, ...props };
}

export function GridIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  );
}

export function SearchIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

export function PlusIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function BellIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <path d="M6 8a6 6 0 0 1 12 0c0 4 1.5 5.5 2 6.5H4c.5-1 2-2.5 2-6.5Z" />
      <path d="M10 19a2 2 0 0 0 4 0" />
    </svg>
  );
}

// Engrenagem de verdade (lucide-react), não o "sol" que tínhamos antes.
export function GearIcon(props: SVGProps<SVGSVGElement>) {
  return <Settings strokeWidth={1.7} {...props} />;
}

export function EyeIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export function ActivityIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <path d="M3 12h4l2-7 4 14 2-7h6" />
    </svg>
  );
}

export function FolderIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
    </svg>
  );
}

export function DocumentIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <path d="M7 3h7l4 4v14H7z" />
      <path d="M14 3v4h4M9 12h6M9 16h6" />
    </svg>
  );
}

export function DocumentPlusIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <path d="M7 3h7l4 4v14H7z" />
      <path d="M14 3v4h4M12 11v6M9 14h6" />
    </svg>
  );
}

export function LayersIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <path d="m12 3 9 5-9 5-9-5 9-5Z" />
      <path d="m3 13 9 5 9-5" />
    </svg>
  );
}

export function FrameIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <rect x="3" y="3" width="18" height="18" rx="1.5" />
      <path d="M3 9h18M9 21V9" />
    </svg>
  );
}

export function CheckCircleIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="9" />
      <path d="m8.5 12.5 2.3 2.3L16 10" />
    </svg>
  );
}

// Ícones da hierarquia NOVA (Universo > Galáxia > Estrela > Planeta) e das
// ações da tela app/nova — todos wrappers do lucide-react, mesmo padrão do
// GearIcon acima.
export function UniversoIcon(props: SVGProps<SVGSVGElement>) {
  return <Globe strokeWidth={1.7} {...props} />;
}

// Galáxia usa o átomo (órbitas cruzadas) — antes era o ícone do Planeta;
// trocado porque o de órbita simples (Orbit) não lia bem como "galáxia".
export function GalaxiaIcon(props: SVGProps<SVGSVGElement>) {
  return <Atom strokeWidth={1.7} {...props} />;
}

export function EstrelaIcon(props: SVGProps<SVGSVGElement>) {
  return <Star strokeWidth={1.7} {...props} />;
}

// Planeta com anel (estilo Saturno) — lucide não tem um ícone de "planeta"
// pronto, então é desenhado à mão, mesmo padrão dos outros ícones customizados
// deste arquivo (base()).
export function PlanetaIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="5" />
      <ellipse cx="12" cy="12" rx="10" ry="3.5" transform="rotate(-20 12 12)" />
    </svg>
  );
}

// Ícone do item "NOVA" na sidebar — distinto do GalaxiaIcon usado na árvore.
export function NovaIcon(props: SVGProps<SVGSVGElement>) {
  return <Network strokeWidth={1.7} {...props} />;
}

export function EditIcon(props: SVGProps<SVGSVGElement>) {
  return <Pencil strokeWidth={1.7} {...props} />;
}

export function TrashIcon(props: SVGProps<SVGSVGElement>) {
  return <Trash2 strokeWidth={1.7} {...props} />;
}

export function ChevronDownIcon(props: SVGProps<SVGSVGElement>) {
  return <ChevronDown strokeWidth={1.7} {...props} />;
}

export function CloseIcon(props: SVGProps<SVGSVGElement>) {
  return <X strokeWidth={1.7} {...props} />;
}

export function LinkIcon(props: SVGProps<SVGSVGElement>) {
  return <Link2 strokeWidth={1.7} {...props} />;
}

// Três pontos preenchidos (não o outline do lucide) — bate com o mockup NOVA.
export function MoreIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <circle cx="5" cy="12" r="1.9" />
      <circle cx="12" cy="12" r="1.9" />
      <circle cx="19" cy="12" r="1.9" />
    </svg>
  );
}

// Seta longa (não chevron) usada como separador no breadcrumb do NOVA.
export function ArrowRightIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <path d="M4 12h15" />
      <path d="m13 6 6 6-6 6" />
    </svg>
  );
}

// Ícones da tela /bridges (estatísticas, badges de status, busca/ordenação
// e paginação da tabela) — todos wrappers do lucide-react.
export function ClockIcon(props: SVGProps<SVGSVGElement>) {
  return <Clock strokeWidth={1.7} {...props} />;
}

export function PackageIcon(props: SVGProps<SVGSVGElement>) {
  return <Package strokeWidth={1.7} {...props} />;
}

export function AlertIcon(props: SVGProps<SVGSVGElement>) {
  return <AlertTriangle strokeWidth={1.7} {...props} />;
}

export function FilterIcon(props: SVGProps<SVGSVGElement>) {
  return <Filter strokeWidth={1.7} {...props} />;
}

export function SortIcon(props: SVGProps<SVGSVGElement>) {
  return <ArrowUpDown strokeWidth={1.7} {...props} />;
}

export function ChevronLeftIcon(props: SVGProps<SVGSVGElement>) {
  return <ChevronLeft strokeWidth={1.7} {...props} />;
}

export function ChevronRightIcon(props: SVGProps<SVGSVGElement>) {
  return <ChevronRight strokeWidth={1.7} {...props} />;
}

// Alça de arrastar — usada no editor manual do Sketch (Bridge-3b).
export function GripIcon(props: SVGProps<SVGSVGElement>) {
  return <GripVertical strokeWidth={1.7} {...props} />;
}

// Alça de redimensionar livre (canto inferior direito) — três traços
// diagonais, estilo Figma/Canva. Usada no editor manual do Sketch (Bridge-3b).
export function ResizeHandleIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" {...props}>
      <path d="M14 2 2 14" />
      <path d="M14 7 7 14" />
      <path d="M14 12l-2 2" />
    </svg>
  );
}
