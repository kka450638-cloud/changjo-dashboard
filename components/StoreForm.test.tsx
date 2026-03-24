import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import StoreForm from "./StoreForm";

const addStore = vi.fn();

vi.mock("@/app/actions/stores", () => ({
  addStore: (...args: unknown[]) => addStore(...args),
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

describe("StoreForm", () => {
  beforeEach(() => {
    addStore.mockReset();
    addStore.mockResolvedValue({ success: true });
  });

  it("도로명 주소 입력 후 제출 시 addStore 호출", async () => {
    const user = userEvent.setup();
    const onSuccess = vi.fn();
    render(<StoreForm onSuccess={onSuccess} />);

    await user.type(
      screen.getByLabelText(/도로명 주소/i),
      "서울특별시 강남구 테헤란로 1",
    );
    await user.click(screen.getByRole("button", { name: /등록$/ }));

    await waitFor(() => {
      expect(addStore).toHaveBeenCalledWith(
        expect.objectContaining({
          address: "서울특별시 강남구 테헤란로 1",
        }),
      );
    });
    expect(onSuccess).toHaveBeenCalled();
  });
});
