"use server";

import { getStoreSummaries, type PeriodKey } from "@/app/actions/sales";
import {
  AI_REPORT_SYSTEM_PROMPT,
  buildAggregatedSummary,
  buildAiReportUserPrompt,
  periodLabelFor,
} from "@/lib/aiReportData";

export type ReportResult =
  | { ok: true; markdown: string }
  | { ok: false; error: string };

/**
 * 일일 AI 판매 리포트 (비스트리밍, 테스트·폴백용)
 * UI는 `/api/ai-report` 스트리밍을 우선 사용합니다.
 */
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
  const periodLabel = periodLabelFor(period);
  const aggregated = buildAggregatedSummary(summaries, periodLabel);
  const userPrompt = buildAiReportUserPrompt(periodLabel, aggregated);

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
          { role: "system", content: AI_REPORT_SYSTEM_PROMPT },
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
