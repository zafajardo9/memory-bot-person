import { describe, expect, it } from "vitest";

import {
  AGENT_TOOLS,
  agentSettingsFromProfile,
  createAgentSchema,
  toolEnabled,
  updateAgentSchema,
} from "../../lib/agents";

describe("agent profiles", () => {
  it("creates agents with the complete tool belt by default", () => {
    const agent = createAgentSchema.parse({
      name: "Research partner",
      description: "Checks technical sources.",
    });
    expect(agent.enabledTools).toEqual(AGENT_TOOLS);
    expect(agent.mood).toBe("balanced");
  });

  it("rejects unknown tools instead of accidentally granting them", () => {
    expect(() =>
      createAgentSchema.parse({
        name: "Unsafe",
        enabledTools: ["knowledge", "shell"],
      }),
    ).toThrow();
  });

  it("supports independent capability sets", () => {
    const agent = updateAgentSchema.parse({
      enabledTools: ["knowledge", "memory"],
    });
    expect(toolEnabled(agent.enabledTools ?? [], "knowledge")).toBe(true);
    expect(toolEnabled(agent.enabledTools ?? [], "web")).toBe(false);
  });

  it("converts a stored agent profile into prompt settings", () => {
    expect(
      agentSettingsFromProfile({
        name: "Planner",
        mood: "analytical",
        responseLength: "detailed",
        customInstructions: "Separate assumptions from facts.",
      }),
    ).toEqual({
      agentName: "Planner",
      mood: "analytical",
      responseLength: "detailed",
      customInstructions: "Separate assumptions from facts.",
      responseLayers: [],
    });
  });
});
