/**
 * OpenAI Chat Completions SSE 스트림에서 delta content 추출 (클라이언트·테스트 공용)
 */
export function extractDeltaContentFromSseLine(line: string): string | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith("data:")) return null;
  const data = trimmed.slice(5).trim();
  if (data === "[DONE]") return null;
  try {
    const json = JSON.parse(data) as {
      choices?: { delta?: { content?: string } }[];
    };
    const c = json.choices?.[0]?.delta?.content;
    return typeof c === "string" && c.length > 0 ? c : null;
  } catch {
    return null;
  }
}

/** ReadableStream을 읽으며 각 delta를 콜백 (브라우저·Node 18+) */
export async function consumeOpenAiSseStream(
  stream: ReadableStream<Uint8Array>,
  onDelta: (chunk: string) => void,
): Promise<void> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let carry = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      carry += decoder.decode(value, { stream: true });
      const parts = carry.split("\n");
      carry = parts.pop() ?? "";
      for (const line of parts) {
        const piece = extractDeltaContentFromSseLine(line);
        if (piece) onDelta(piece);
      }
    }
    if (carry.trim()) {
      const piece = extractDeltaContentFromSseLine(carry);
      if (piece) onDelta(piece);
    }
  } finally {
    reader.releaseLock();
  }
}
