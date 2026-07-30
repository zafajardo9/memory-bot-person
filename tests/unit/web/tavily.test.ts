import { afterEach, describe, expect, it, vi } from "vitest";

import { createTavilyProvider } from "../../../lib/web/tavily";

describe("Tavily provider", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("maps the current Tavily response and sends bounded search options", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        results: [
          {
            title: "Example",
            url: "https://example.com/article",
            content: "A useful snippet.",
            score: 0.91,
            published_date: "2026-07-28",
          },
        ],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const results = await createTavilyProvider("secret-key").search(
      "current topic",
      3,
    );

    expect(results).toEqual([
      {
        title: "Example",
        url: "https://example.com/article",
        content: "A useful snippet.",
        score: 0.91,
        publishedDate: "2026-07-28",
      },
    ]);
    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers.Authorization).toBe("Bearer secret-key");
    expect(JSON.parse(init.body)).toMatchObject({
      query: "current topic",
      max_results: 3,
      search_depth: "basic",
      include_raw_content: false,
    });
  });

  it("returns a safe quota error without exposing the provider body", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("account details", { status: 429 }),
      ),
    );

    await expect(
      createTavilyProvider("secret-key").search("topic", 5),
    ).rejects.toThrow("quota is temporarily exhausted");
  });

  it("rejects malformed upstream responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(Response.json({ results: [{ nope: true }] })),
    );

    await expect(
      createTavilyProvider("secret-key").search("topic", 5),
    ).rejects.toThrow("invalid response");
  });
});

