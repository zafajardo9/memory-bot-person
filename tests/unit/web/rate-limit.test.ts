import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  upsert: vi.fn(),
  updateMany: vi.fn(),
  findUniqueOrThrow: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: (callback: (tx: unknown) => unknown) =>
      callback({
        webSearchUsage: {
          upsert: mocks.upsert,
          updateMany: mocks.updateMany,
          findUniqueOrThrow: mocks.findUniqueOrThrow,
        },
      }),
  },
}));

import { consumeWebSearchQuota } from "../../../lib/web/rate-limit";

describe("web search quota", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.WEB_SEARCH_MAX_DAILY = "2";
    mocks.upsert.mockResolvedValue({});
    mocks.updateMany.mockResolvedValue({ count: 1 });
    mocks.findUniqueOrThrow.mockResolvedValue({ count: 1 });
  });

  it("uses a UTC day key and an atomic count boundary", async () => {
    await expect(
      consumeWebSearchQuota(
        "00000000-0000-4000-8000-000000000001",
        new Date("2026-07-29T23:59:59-07:00"),
      ),
    ).resolves.toEqual({ used: 1, limit: 2, remaining: 1 });

    expect(mocks.updateMany).toHaveBeenCalledWith({
      where: {
        userId: "00000000-0000-4000-8000-000000000001",
        day: new Date("2026-07-30T00:00:00.000Z"),
        count: { lt: 2 },
      },
      data: { count: { increment: 1 } },
    });
  });

  it("rejects without a provider call when the allowance is exhausted", async () => {
    mocks.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      consumeWebSearchQuota(
        "00000000-0000-4000-8000-000000000001",
        new Date("2026-07-29T00:00:00Z"),
      ),
    ).rejects.toThrow("daily web search limit of 2");
    expect(mocks.findUniqueOrThrow).not.toHaveBeenCalled();
  });
});
