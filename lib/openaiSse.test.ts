import { describe, it, expect } from "vitest";
import { extractDeltaContentFromSseLine } from "./openaiSse";

describe("extractDeltaContentFromSseLine", () => {
  it("delta content 추출", () => {
    const line =
      'data: {"choices":[{"delta":{"content":"안녕"}}],"object":"chat.completion.chunk"}';
    expect(extractDeltaContentFromSseLine(line)).toBe("안녕");
  });

  it("[DONE]은 null", () => {
    expect(extractDeltaContentFromSseLine("data: [DONE]")).toBeNull();
  });

  it("data: 아님", () => {
    expect(extractDeltaContentFromSseLine(": ping")).toBeNull();
  });
});
