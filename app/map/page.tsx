import MapClient from "@/components/MapClient";
import type { PeriodKey } from "@/app/actions/sales";

export const dynamic = "force-dynamic";

export default async function MapPage(props: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = (await props.searchParams) ?? {};
  const rawPeriod = sp.period;
  const period = (Array.isArray(rawPeriod) ? rawPeriod[0] : rawPeriod) as PeriodKey | undefined;
  const initialPeriod: PeriodKey =
    period === "yesterday" || period === "1w" || period === "1m" || period === "6m" || period === "all"
      ? period
      : "1w";

  return <MapClient initialPeriod={initialPeriod} />;
}

