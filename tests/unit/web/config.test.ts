import { afterEach, describe, expect, it, vi } from "vitest";

import { isAgentBrowserEnabled } from "@/lib/web/config";

describe("isAgentBrowserEnabled", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("stays disabled on Vercel when no browser executable is provided", () => {
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("AGENT_BROWSER_ENABLED", "true");
    vi.stubEnv("AGENT_BROWSER_BINARY_PATH", "");

    expect(isAgentBrowserEnabled()).toBe(false);
  });

  it("allows an explicitly managed executable on persistent compute", () => {
    vi.stubEnv("VERCEL", "");
    vi.stubEnv("AGENT_BROWSER_ENABLED", "true");
    vi.stubEnv("AGENT_BROWSER_BINARY_PATH", "/opt/bin/agent-browser");

    expect(isAgentBrowserEnabled()).toBe(true);
  });

  it("defaults to disabled in production", () => {
    vi.stubEnv("VERCEL", "");
    vi.stubEnv("AGENT_BROWSER_ENABLED", "");
    vi.stubEnv("NODE_ENV", "production");

    expect(isAgentBrowserEnabled()).toBe(false);
  });
});
