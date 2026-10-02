import type { Funcao, PermissionLevel } from "@prisma/client";

export interface ApiUserRow {
  id: string;
  name: string;
  email: string;
  funcao: Funcao;
  permissionLevel: PermissionLevel;
  active: boolean;
  createdAt: string;
  galaxies: { id: string; name: string }[];
}

export interface ApiUsersResponse {
  items: ApiUserRow[];
  total: number;
  page: number;
  totalPages: number;
  pageSize: number;
}
