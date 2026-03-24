import { describe, expect, it } from "vitest";
import { storeFromSupabaseRow } from "./storeMapper";

describe("storeFromSupabaseRow", () => {
  it("maps manager_phone to managerPhone", () => {
    const s = storeFromSupabaseRow({
      id: "a",
      name: "점",
      region: "서울 강남구",
      lat: 37,
      lng: 127,
      created_at: "2024-01-01",
      manager_phone: "010-1111-2222",
    });
    expect(s.managerPhone).toBe("010-1111-2222");
  });

  it("handles null manager_phone", () => {
    const s = storeFromSupabaseRow({
      id: "b",
      name: "점",
      lat: 1,
      lng: 2,
      created_at: "2024-01-01",
      manager_phone: null,
    });
    expect(s.managerPhone).toBeNull();
  });
});
