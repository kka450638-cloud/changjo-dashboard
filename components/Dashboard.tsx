"use client";

import { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import { createClient } from "@/lib/supabase/client";
import type { Store } from "@/lib/types/store";
import StoreForm from "./StoreForm";

const StoreMap = dynamic(() => import("./StoreMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center rounded-xl bg-zinc-100 dark:bg-zinc-800">
      <p className="text-zinc-500">지도 불러오는 중…</p>
    </div>
  ),
});

export default function Dashboard() {
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchStores = useCallback(async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("stores")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error) setStores((data as Store[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchStores();
  }, [fetchStores]);

  return (
    <div className="flex h-screen w-full flex-col md:flex-row">
      <aside className="flex w-full flex-shrink-0 flex-col gap-6 border-zinc-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-900 md:w-[30%] md:max-w-md md:border-r">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-amber-600 dark:text-amber-400">창조통닭</h1>
          <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">가맹점 지도 대시보드</p>
        </div>
        <StoreForm onSuccess={fetchStores} />
        {!loading && (
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            등록된 지점: <strong className="text-zinc-700 dark:text-zinc-300">{stores.length}</strong>곳
          </p>
        )}
      </aside>
      <main className="relative flex-1 min-h-[400px] md:min-h-0 p-4 md:p-6">
        <div className="h-full w-full overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50 shadow-sm dark:border-zinc-700 dark:bg-zinc-800">
          <StoreMap stores={stores} />
        </div>
      </main>
    </div>
  );
}
