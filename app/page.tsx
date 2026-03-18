"use client";

import { Toaster } from "sonner";
import RegionSalesMap from "@/components/RegionSalesMap";

export default function Home() {
  return (
    <>
      <RegionSalesMap />
      <Toaster
        position="top-center"
        toastOptions={{
          classNames: {
            toast: "bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 shadow-lg",
          },
        }}
      />
    </>
  );
}
