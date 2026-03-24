import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getStoreSummaries, type PeriodKey } from "@/app/actions/sales";
import {
  AI_REPORT_SYSTEM_PROMPT,
  buildAggregatedSummary,
  buildAiReportUserPrompt,
  periodLabelFor,
} from "@/lib/aiReportData";

const PERIOD_KEYS = new Set<PeriodKey>([
  "yesterday",
  "1w",
  "1m",
  "6m",
  "all",
]);

const ADMIN_COOKIE = "changjo_admin_ok";

export const maxDuration = 120;

/**
 * AI 리포트 스트리밍 (OpenAI SSE 그대로 전달)
 * — 쿠키로 관리자 세션 확인, POST JSON { period }
 */
export async function POST(request: Request) {
  const jar = await cookies();
  if (jar.get(ADMIN_COOKIE)?.value !== "1") {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY가 설정되지 않았습니다." },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청 본문입니다." }, { status: 400 });
  }

  const period = (body as { period?: string }).period as PeriodKey | undefined;
  if (!period || !PERIOD_KEYS.has(period)) {
    return NextResponse.json({ error: "유효하지 않은 기간입니다." }, { status: 400 });
  }

  const summaries = await getStoreSummaries(period);
  const periodLabel = periodLabelFor(period);
  const aggregated = buildAggregatedSummary(summaries, periodLabel);
  const userPrompt = buildAiReportUserPrompt(periodLabel, aggregated);

  const upstream = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      stream: true,
      messages: [
        { role: "system", content: AI_REPORT_SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      max_tokens: 2000,
    }),
  });

  if (!upstream.ok) {
    const text = await upstream.text();
    return NextResponse.json(
      { error: `OpenAI 오류 (${upstream.status})`, detail: text.slice(0, 300) },
      { status: 502 },
    );
  }

  if (!upstream.body) {
    return NextResponse.json({ error: "스트림을 열 수 없습니다." }, { status: 502 });
  }

  return new Response(upstream.body, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
