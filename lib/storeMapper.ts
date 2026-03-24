import type { Store } from "@/lib/types/store";

/** Supabase `stores` 행 (스네이크 케이스) */
export type SupabaseStoreRow = {
  id: string;
  name: string;
  region?: string | null;
  lat: number | string;
  lng: number | string;
  created_at: string;
  manager_phone?: string | null;
};

export function storeFromSupabaseRow(row: SupabaseStoreRow): Store {
  return {
    id: row.id,
    name: row.name,
    region: row.region ?? undefined,
    lat: Number(row.lat),
    lng: Number(row.lng),
    created_at: row.created_at,
    managerPhone: row.manager_phone ?? null,
  };
}
