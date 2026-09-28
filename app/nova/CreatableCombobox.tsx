"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  value: string;
  onChange: (value: string) => void;
  suggestions: string[];
  placeholder?: string;
  disabled?: boolean;
}

// Combobox "criável": input de texto livre com sugestões (pré-definidas +
// já usadas por outros exemplos), filtradas pelo que foi digitado. Não
// precisa de uma ação separada de "criar" — referenceType é uma coluna
// livre no banco (sem tabela de catálogo), então o próprio texto digitado
// já é o valor; a opção "+ Criar novo tipo" é só uma dica visual de que
// digitar algo novo funciona normalmente.
export default function CreatableCombobox({ value, onChange, suggestions, placeholder, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const query = value.trim().toLowerCase();
  const filtered = query ? suggestions.filter((s) => s.toLowerCase().includes(query)) : suggestions;
  const exactMatch = suggestions.some((s) => s.toLowerCase() === query);
  const showCreateOption = value.trim().length > 0 && !exactMatch;

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        value={value}
        disabled={disabled}
        onChange={(event) => {
          onChange(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        autoComplete="off"
        className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none focus:border-luminous-primary"
      />
      {open && !disabled && (filtered.length > 0 || showCreateOption) && (
        <ul className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-white/10 bg-luminous-surface-container shadow-xl">
          {filtered.map((suggestion) => (
            <li key={suggestion}>
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  onChange(suggestion);
                  setOpen(false);
                }}
                className="block w-full truncate px-3 py-2 text-left text-sm text-luminous-on-surface hover:bg-white/10"
              >
                {suggestion}
              </button>
            </li>
          ))}
          {showCreateOption && (
            <li>
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => setOpen(false)}
                className="block w-full truncate px-3 py-2 text-left text-sm text-luminous-primary-fixed-dim hover:bg-white/10"
              >
                + Criar novo tipo: &ldquo;{value.trim()}&rdquo;
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
