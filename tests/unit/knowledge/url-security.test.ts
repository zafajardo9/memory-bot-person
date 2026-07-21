import { describe, expect, it } from "vitest";

import { validatePublicUrl } from "../../../lib/knowledge/url-security";

describe("validatePublicUrl", () => {
  it.each([
    "http://127.0.0.1/secret",
    "http://10.0.0.1/secret",
    "http://192.168.1.1/secret",
    "http://[::1]/secret",
    "ftp://example.com/file",
    "https://user:password@example.com/private",
  ])("rejects unsafe URL %s", async (url) => {
    await expect(validatePublicUrl(url)).rejects.toThrow();
  });

  it("normalizes fragments from public URLs", async () => {
    const url = await validatePublicUrl("https://example.com/handbook#payroll");
    expect(url.toString()).toBe("https://example.com/handbook");
  });
});
