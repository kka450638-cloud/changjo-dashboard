"use server";

import { getStoreSummaries, type PeriodKey } from "@/app/actions/sales";

const PERIOD_LABELS: Record<PeriodKey, string> = {
  yesterday: "전일",
  "1w": "1주",
  "1m": "1개월",
  "6m": "6개월",
  all: "전체",
};

/** 1만 개 지점 규모를 고려해 집계 데이터만 생성 (원본 개별 지점 전송 X) */
function buildAggregatedSummary(
  summaries: { store: { id: string; name: string; region?: string }; totalQuantity: number }[],
  periodLabel: string,
): string {
  const totalStores = summaries.length;
  const totalQty = summaries.reduce((s, x) => s + x.totalQuantity, 0);
  const avgPerStore = totalStores > 0 ? Math.round(totalQty / totalStores) : 0;

  // 시/도 단위 집계 (region 첫 단어 또는 전체)
  const byRegion = new Map<
    string,
    { stores: number; quantity: number }
  >();
  for (const { store, totalQuantity } of summaries) {
    const region = store.region?.trim() || "미지정";
    const sido = region.split(/\s+/)[0] || region;
    const cur = byRegion.get(sido) ?? { stores: 0, quantity: 0 };
    cur.stores += 1;
    cur.quantity += totalQuantity;
    byRegion.set(sido, cur);
  }

  const regionRows = Array.from(byRegion.entries())
    .map(([sido, v]) => ({ sido, ...v }))
    .sort((a, b) => b.quantity - a.quantity);

  const topRegions = regionRows.slice(0, 15);
  const bottomRegions = regionRows.slice(-5).reverse();

  // 상위/하위 지점 (이름·지역·마리수) — 개수 제한
  const sortedStores = [...summaries].sort(
    (a, b) => b.totalQuantity - a.totalQuantity,
  );
  const topStores = sortedStores.slice(0, 20);
  const bottomStores = sortedStores.slice(-10);

  let text = `## 기간: ${periodLabel}\n`;
  text += `- 전체 지점 수: ${totalStores.toLocaleString()}개\n`;
  text += `- 총 판매 마리 수: ${totalQty.toLocaleString()}마리\n`;
  text += `- 지점당 평균: ${avgPerStore.toLocaleString()}마리\n\n`;

  text += `### 지역(시/도)별 집계 (상위 15)\n`;
  topRegions.forEach(
    (r) =>
      (text += `- ${r.sido}: 지점 ${r.stores}개, 누적 ${r.quantity.toLocaleString()}마리\n`),
  );
  text += `\n### 지역별 하위 5개\n`;
  bottomRegions.forEach(
    (r) =>
      (text += `- ${r.sido}: 지점 ${r.stores}개, 누적 ${r.quantity.toLocaleString()}마리\n`),
  );

  text += `\n### 판매 상위 20개 지점\n`;
  topStores.forEach(
    (s) =>
      (text += `- ${s.store.name} (${s.store.region ?? ""}): ${s.totalQuantity.toLocaleString()}마리\n`),
  );
  text += `\n### 판매 하위 10개 지점\n`;
  bottomStores.forEach(
    (s) =>
      (text += `- ${s.store.name} (${s.store.region ?? ""}): ${s.totalQuantity.toLocaleString()}마리\n`),
  );

  return text;
}

export type ReportResult =
  | { ok: true; markdown: string }
  | { ok: false; error: string };

/** 일일 AI 판매 리포트 생성 (1만 지점 목표, 집계 데이터만 전달) */
export async function generateAiReport(
  period: PeriodKey,
): Promise<ReportResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey?.trim()) {
    return {
      ok: false,
      error: "OPENAI_API_KEY가 설정되지 않았습니다. .env.local에 추가해주세요.",
    };
  }

  const summaries = await getStoreSummaries(period);
  const periodLabel = PERIOD_LABELS[period];
  const aggregated = buildAggregatedSummary(summaries, periodLabel);

  const systemPrompt = `당신은 창조통닭 프랜차이즈의 지역별 판매 분석 전문가입니다.
제공되는 데이터는 이미 지역·지점 수·판매량으로 집계된 요약입니다.
**목표는 전국 1만 개 지점 확장**이므로, 매일 점검할 수 있는 일일 리포트 형식으로, 확장성·지역 균형·신규 진출 관점의 인사이트를 제시해주세요.
답변은 반드시 한국어로, 마크다운 형식으로 작성해주세요.`;

  const userPrompt = `아래는 "${periodLabel}" 기간의 실제 입력된 판매 데이터 집계입니다.
**1만 개 지점 목표**에 맞춰 **일일 리포트** 형식으로 다음을 작성해주세요:

1. **오늘(또는 해당 기간) 한 줄 요약**: 전체 판매·지점 수를 한 문장으로
2. **일일 KPI 요약**: 총 지점 수, 총 판매 마리 수, 지점당 평균, 전일 대비 또는 기간 대비 포인트
3. **지역별 하이라이트**: 상위/하위 지역·지점 패턴 (1만 지점 확장 시 참고할 지역)
4. **1만 지점 관점 오늘의 액션**: 신규 진출 추천 지역, 당장 손봐야 할 저성과 지점·지역, 단기 개선 제안

집계 데이터:\n${aggregated}`;

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        max_tokens: 2000,
      }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      return {
        ok: false,
        error: `OpenAI API 오류 (${res.status}): ${errBody.slice(0, 200)}`,
      };
    }

    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content =
      data.choices?.[0]?.message?.content?.trim() ||
      "리포트 내용을 생성하지 못했습니다.";

    return { ok: true, markdown: content };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `리포트 생성 실패: ${message}` };
  }
}
