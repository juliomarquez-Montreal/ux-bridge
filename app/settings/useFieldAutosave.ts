"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

// Autosave genérico pra um campo: `onChange` agenda o save ~debounceMs depois
// de parar de digitar; `flush` salva na hora (blur / Enter / seleção direta
// de um <select>). Nunca salva se o valor não mudou desde o último save.
export function useFieldAutosave(onSave: (value: string) => Promise<void>, debounceMs = 600) {
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const lastSavedRef = useRef<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const clearStatusRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(
    () => () => {
      clearTimeout(debounceRef.current);
      clearTimeout(clearStatusRef.current);
    },
    []
  );

  const commit = useCallback(
    async (value: string) => {
      if (value === lastSavedRef.current) return;
      clearTimeout(clearStatusRef.current);
      setStatus("saving");
      setError(null);
      try {
        await onSave(value);
        lastSavedRef.current = value;
        setStatus("saved");
        clearStatusRef.current = setTimeout(() => setStatus("idle"), 2500);
      } catch (err) {
        setStatus("error");
        setError(err instanceof Error ? err.message : "Falha ao salvar.");
      }
    },
    [onSave]
  );

  const onChange = useCallback(
    (value: string) => {
      clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => commit(value), debounceMs);
    },
    [commit, debounceMs]
  );

  const flush = useCallback(
    (value: string) => {
      clearTimeout(debounceRef.current);
      commit(value);
    },
    [commit]
  );

  // Define o valor "salvo" atual sem disparar um save (usado ao carregar os dados iniciais).
  const setBaseline = useCallback((value: string) => {
    lastSavedRef.current = value;
  }, []);

  return { status, error, onChange, flush, setBaseline };
}
