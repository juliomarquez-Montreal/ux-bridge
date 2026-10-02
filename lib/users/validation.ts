import type { Funcao, PermissionLevel } from "@prisma/client";

export const FUNCOES: Funcao[] = ["PO", "UX", "GERENTE_PROJETOS", "OUTROS"];
export const PERMISSIONS: PermissionLevel[] = ["ADMIN", "USER"];
export const MIN_PASSWORD_LENGTH = 8;

export const FUNCAO_LABEL: Record<Funcao, string> = {
  PO: "PO",
  UX: "UX",
  GERENTE_PROJETOS: "Gerente de Projetos",
  OUTROS: "Outros",
};
export const PERMISSION_LABEL: Record<PermissionLevel, string> = { ADMIN: "Administrador", USER: "Usuário" };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const isValidEmail = (email: string) => EMAIL_RE.test(email);
