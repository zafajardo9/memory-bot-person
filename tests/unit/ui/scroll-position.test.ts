import { describe, expect, it } from "vitest";

import { isNearBottom } from "../../../components/custom/use-scroll-to-bottom";

describe("chat scroll position", () => {
  it("follows output when the reader is near the latest message", () => {
    expect(
      isNearBottom({ clientHeight: 600, scrollHeight: 2_000, scrollTop: 1_320 }),
    ).toBe(true);
  });

  it("preserves the reading position when the reader is farther up", () => {
    expect(
      isNearBottom({ clientHeight: 600, scrollHeight: 2_000, scrollTop: 900 }),
    ).toBe(false);
  });

  it("allows a custom follow threshold", () => {
    expect(
      isNearBottom(
        { clientHeight: 600, scrollHeight: 2_000, scrollTop: 1_350 },
        40,
      ),
    ).toBe(false);
  });
});
