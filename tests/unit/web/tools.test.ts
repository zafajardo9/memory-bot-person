import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/web/extract", () => ({
  fetchAndExtractWebPage: vi.fn(),
}));
vi.mock("@/lib/web/rate-limit", () => ({
  consumeWebSearchQuota: vi.fn(),
}));
vi.mock("@/lib/web/service", () => ({
  getWebSearchProvider: vi.fn(),
}));

import { createWebTools } from "@/ai/tools/web-search";

describe("web tool availability", () => {
  it("keeps direct page reading available without a Tavily key", () => {
    const tools = createWebTools("user-id", { searchEnabled: false });
    expect(tools).toHaveProperty("readWebPage");
    expect(tools).not.toHaveProperty("webSearch");
  });

  it("adds Tavily search when its credential is configured", () => {
    const tools = createWebTools("user-id", { searchEnabled: true });
    expect(tools).toHaveProperty("readWebPage");
    expect(tools).toHaveProperty("webSearch");
  });
});
