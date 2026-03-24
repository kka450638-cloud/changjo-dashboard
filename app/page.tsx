import { Suspense } from "react";
import HomeView from "./home-view";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ mapDate?: string }>;
}) {
  const sp = await searchParams;
  const raw = sp.mapDate;
  const initialMapDate =
    raw && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : null;

  return (
    <Suspense fallback={null}>
      <HomeView initialMapDate={initialMapDate} />
    </Suspense>
  );
}
