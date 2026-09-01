import { afterEach, describe, expect, it, vi } from "vitest";

import { createTinyFishProvider } from "../../../lib/web/tinyfish";

describe("TinyFish provider", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("maps the current TinyFish response with a derived score and source", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        query: "current topic",
        results: [
          {
            position: 0,
            site_name: "Example",
            snippet: "A useful snippet.",
            title: "Example",
            url: "https://example.com/article",
            date: "2026-07-28",
          },
          {
            position: 1,
            site_name: "Example",
            snippet: "A second snippet.",
            title: "Second",
            url: "https://example.com/second",
          },
        ],
        total_results: 2,
        page: 0,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const results = await createTinyFishProvider("secret-key").search(
      "current topic",
      3,
    );

    expect(results).toEqual([
      {
        title: "Example",
        url: "https://example.com/article",
        content: "A useful snippet.",
        score: 1,
        source: "TinyFish",
        publishedDate: "2026-07-28",
      },
      {
        title: "Second",
        url: "https://example.com/second",
        content: "A second snippet.",
        score: 0.9,
        source: "TinyFish",
      },
    ]);
    const [url] = fetchMock.mock.calls[0];
    expect(new URL(url).hostname).toBe("api.search.tinyfish.ai");
    expect(new URL(url).searchParams.get("query")).toBe("current topic");
  });

  it("maps recency and domain filters to the TinyFish contract", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(Response.json({ query: "recent launch", results: [], total_results: 0 }));
    vi.stubGlobal("fetch", fetchMock);

    await createTinyFishProvider("secret-key").search("recent launch", 5, {
      timeRange: "week",
      searchDepth: "advanced",
      includeDomains: ["github.com", "arxiv.org"],
      excludeDomains: ["reddit.com"],
    });

    const [url] = fetchMock.mock.calls[0];
    const params = new URL(url).searchParams;
    expect(params.get("recency_minutes")).toBe("10080");
    expect(params.get("include_domains")).toBe("github.com,arxiv.org");
    expect(params.get("exclude_domains")).toBe("reddit.com");
  });

  it("caps results at maxResults because the API has no result-count parameter", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        query: "topic",
        results: Array.from({ length: 12 }, (_, index) => ({
          position: index,
          site_name: "S",
          snippet: `snippet ${index}`,
          title: `title ${index}`,
          url: `https://example.com/${index}`,
        })),
        total_results: 12,
        page: 0,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const results = await createTinyFishProvider("secret-key").search(
      "topic",
      5,
    );

    expect(results).toHaveLength(5);
  });

  it("returns a safe quota error for rate limiting", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("rate limited", { status: 429 })),
    );

    await expect(
      createTinyFishProvider("secret-key").search("topic", 5),
    ).rejects.toThrow("quota is temporarily exhausted");
  });

  it("returns a safe generic error without leaking the upstream body", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("account details that must not leak", { status: 500 }),
      ),
    );

    await expect(
      createTinyFishProvider("secret-key").search("topic", 5),
    ).rejects.toThrow("The web search provider request failed");
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it("fails closed when the key is missing", () => {
    expect(() => createTinyFishProvider("")).toThrow(
      "TinyFish is not configured.",
    );
    expect(() => createTinyFishProvider("   ")).toThrow(
      "TinyFish is not configured.",
    );
  });
});
