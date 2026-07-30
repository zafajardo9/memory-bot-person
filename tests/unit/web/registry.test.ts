import { describe, expect, it } from "vitest";

import {
  createWebSearchProvider,
  listWebSearchProviderIds,
} from "../../../lib/web/registry";

describe("web search provider registry", () => {
  it("registers Tavily behind the common provider contract", () => {
    expect(listWebSearchProviderIds()).toEqual(["tavily"]);
    expect(createWebSearchProvider("tavily", "test-key")).toMatchObject({
      id: "tavily",
      label: "Tavily",
      environmentKey: "TAVILY_API_KEY",
    });
  });

  it("rejects unsupported providers", () => {
    expect(() => createWebSearchProvider("unknown", "test-key")).toThrow(
      "Unsupported web search provider",
    );
  });
});

