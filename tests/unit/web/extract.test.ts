import { afterEach, describe, expect, it } from "vitest";

import { extractReadableWebContent } from "../../../lib/web/extract";

describe("web page extraction", () => {
  afterEach(() => {
    delete process.env.WEB_PAGE_MAX_CHARACTERS;
  });

  it("removes active and navigational HTML while retaining article text", () => {
    const html = `
      <html><head><title>Guide</title><script>steal()</script></head>
      <body><nav>Menu</nav><main><h1>Guide</h1><p>Useful article text for the assistant.</p></main></body></html>
    `;
    const result = extractReadableWebContent(
      new TextEncoder().encode(html),
      "text/html",
      "https://example.com/guide",
    );

    expect(result.content).toContain("Useful article text");
    expect(result.content).not.toContain("steal");
    expect(result.content).not.toContain("Menu");
    expect(result.truncated).toBe(false);
  });

  it("truncates returned text at the configured model-context boundary", () => {
    process.env.WEB_PAGE_MAX_CHARACTERS = "10";
    expect(
      extractReadableWebContent(
        new TextEncoder().encode("123456789012345"),
        "text/plain",
        "https://example.com/file.txt",
      ),
    ).toEqual({ content: "1234567890", truncated: true });
  });

  it("rejects unsupported binary content", () => {
    expect(() =>
      extractReadableWebContent(
        new Uint8Array([1, 2, 3]),
        "application/pdf",
        "https://example.com/file.pdf",
      ),
    ).toThrow("not a supported text");
  });
});

