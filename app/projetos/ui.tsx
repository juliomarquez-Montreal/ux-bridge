"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { CloseIcon } from "@/components/icons";

// Primitivos do TEMA CLARO de /projetos e /projetos/[id] — cores extraídas
// do mockup Layout/Projetos.html (fundo #F4F5F7, cards brancos com borda
// #E6E8EC e raio 10px, roxo #8B40F5, azul #1F6FE8, verde #1A7A3C...). O tema
// claro é EXCLUSIVO dessas rotas; o resto do app continua no escuro.

export const LIGHT = {
  pageBg: "bg-[#F4F5F7]",
  text: "text-[#1D1F25]",
  muted: "text-[#50545C]",
  subtle: "text-[#6B6F77]",
  border: "border-[#E6E8EC]",
} as const;

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <section
      className={`rounded-[10px] border border-[#E6E8EC] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)] ${className}`}
    >
      {children}
    </section>
  );
}

export function CardTitle({ icon, children, right }: { icon?: ReactNode; children: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h3 className="flex items-center gap-2.5 text-[17px] font-bold text-[#1D1F25]">
        {icon && <span className="text-[#1D1F25]">{icon}</span>}
        {children}
      </h3>
      {right}
    </div>
  );
}

type Variant = "primary" | "secondary" | "danger" | "ghost";

const VARIANT: Record<Variant, string> = {
  primary: "bg-[#8B40F5] text-white hover:bg-[#7B3BF0] border border-transparent",
  secondary: "bg-white text-[#1D1F25] border border-[#D7DAE0] hover:bg-[#F4F5F7]",
  danger: "bg-[#E5484D] text-white hover:bg-[#C42B2B] border border-transparent",
  ghost: "bg-transparent text-[#50545C] border border-transparent hover:bg-[#F4F5F7]",
};

export function Btn({
  variant = "secondary",
  className = "",
  small = false,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; small?: boolean }) {
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-2 rounded-[7px] font-medium transition active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 ${
        small ? "px-3 py-1.5 text-[13px]" : "px-4 py-2.5 text-[14.5px]"
      } ${VARIANT[variant]} ${className}`}
    />
  );
}

type Tone = "green" | "blue" | "gray" | "red" | "amber" | "purple";

const TONE: Record<Tone, string> = {
  green: "bg-[#DCF4E3] text-[#1A7A3C]",
  blue: "bg-[#DBE8FC] text-[#1A5FD0]",
  gray: "bg-[#ECEEF1] text-[#3A3D44]",
  red: "bg-[#FDE3E3] text-[#C42B2B]",
  amber: "bg-[#FDF0CC] text-[#8A5A00]",
  purple: "bg-[#EFE5FD] text-[#6B2FD1]",
};

export function Pill({ tone = "gray", children, className = "" }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center rounded-[6px] px-2.5 py-1 text-[13px] font-medium ${TONE[tone]} ${className}`}>
      {children}
    </span>
  );
}

export const fieldClass =
  "w-full rounded-lg border border-[#D7DAE0] bg-white px-3 py-2 text-sm text-[#1D1F25] outline-none transition placeholder:text-[#9A9EA6] focus:border-[#8B40F5] focus:ring-2 focus:ring-[#8B40F5]/15";

export const labelClass = "mb-1.5 block text-xs font-semibold uppercase tracking-[.05em] text-[#6B6F77]";

// Casca padrão de modal do tema claro (overlay escurecido + cartão branco).
export function Modal({
  title,
  onClose,
  children,
  maxWidth = "max-w-md",
  busy = false,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  maxWidth?: string;
  busy?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#15161A]/50 p-4 backdrop-blur-[2px]" onClick={() => !busy && onClose()}>
      <div
        role="dialog"
        aria-modal="true"
        className={`max-h-[85vh] w-full ${maxWidth} animate-[fadeIn_0.2s_ease-out] overflow-y-auto rounded-xl border border-[#E6E8EC] bg-white p-6 text-[#1D1F25] shadow-[0_12px_40px_rgba(16,24,40,0.18)]`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-[#15161A]">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Fechar"
            className="text-[#6B6F77] transition hover:text-[#1D1F25]"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
