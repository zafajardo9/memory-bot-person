import { describe, expect, it } from "vitest";

import { parseSlashSkill, stripLeadingSkillCommand } from "@/lib/skills";

import type { UIMessage } from "ai";

function userMessage(text: string): UIMessage {
  return { id: "user-1", role: "user", parts: [{ type: "text", text }] };
}

describe("chat skill slash commands", () => {
  it("parses a leading command and preserves the trailing request", () => {
    expect(parseSlashSkill("/brief on Q3 revenue")).toEqual({
      slug: "brief",
      rest: "on Q3 revenue",
    });
    expect(parseSlashSkill("/BRIEF\nQ3 revenue")).toEqual({
      slug: "brief",
      rest: "Q3 revenue",
    });
  });

  it("ignores mid-message and malformed commands", () => {
    expect(parseSlashSkill("Please use /brief here")).toBeNull();
    expect(parseSlashSkill("/bad_slug request")).toBeNull();
  });

  it("strips only the latest user message command", () => {
    const messages = [
      userMessage("/brief earlier"),
      { id: "assistant-1", role: "assistant" as const, parts: [{ type: "text" as const, text: "Done" }] },
      { ...userMessage("/brief current request"), id: "user-2" },
    ];
    const stripped = stripLeadingSkillCommand(messages, "brief");
    expect(stripped[0].parts[0]).toMatchObject({ text: "/brief earlier" });
    expect(stripped[2].parts[0]).toMatchObject({ text: "current request" });
  });
});
