import { describe, expect, it } from "vitest";

import { resolveActiveAgentId } from "../../../components/custom/active-agent-context";

describe("active agent resolution", () => {
  it("uses the agent encoded in an agent-scoped route", () => {
    expect(
      resolveActiveAgentId({
        defaultAgentId: "default-agent",
        pathname: "/agents/route-agent/settings",
        registeredAgentId: "registered-agent",
      }),
    ).toBe("route-agent");
  });

  it("uses the agent registered by a saved chat", () => {
    expect(
      resolveActiveAgentId({
        defaultAgentId: "default-agent",
        pathname: "/chat/chat-id",
        registeredAgentId: "chat-agent",
      }),
    ).toBe("chat-agent");
  });

  it("keeps an unresolved saved chat neutral", () => {
    expect(
      resolveActiveAgentId({
        defaultAgentId: "default-agent",
        pathname: "/chat/chat-id",
        registeredAgentId: null,
      }),
    ).toBeUndefined();
  });

  it("falls back to the default agent on general workspace pages", () => {
    expect(
      resolveActiveAgentId({
        defaultAgentId: "default-agent",
        pathname: "/tools",
        registeredAgentId: null,
      }),
    ).toBe("default-agent");
  });
});
