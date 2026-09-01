import { describe, expect, it } from "vitest";

import {
  activeChatTitle,
  agentBadgeClass,
  sessionsToRecents,
} from "../../../lib/chat/sidebar";

const sessions = [
  {
    id: "chat_1",
    agentId: "agent_1",
    createdAt: new Date("2026-01-01"),
    title: "  Q3 planning  ",
  },
  {
    id: "chat_2",
    agentId: "agent_2",
    createdAt: new Date("2026-01-02"),
    title: "",
  },
];

const agents = [
  { id: "agent_1", name: "lawBOT", color: "blue" },
  { id: "agent_2", name: "Kairo", color: "violet" },
];

describe("chat sidebar history mapping", () => {
  it("maps sessions to recents with trimmed labels and a fallback", () => {
    expect(sessionsToRecents(sessions)).toEqual([
      { id: "chat_1", label: "Q3 planning" },
      { id: "chat_2", label: "Untitled chat" },
    ]);
  });

  it("attaches agent identity when agents are known", () => {
    expect(sessionsToRecents(sessions, agents)).toEqual([
      {
        id: "chat_1",
        label: "Q3 planning",
        agent: {
          name: "lawBOT",
          monogram: "L",
          badgeClassName: "bg-blue-500/15 text-blue-600 dark:text-blue-300",
        },
      },
      {
        id: "chat_2",
        label: "Untitled chat",
        agent: {
          name: "Kairo",
          monogram: "K",
          badgeClassName:
            "bg-violet-500/15 text-violet-600 dark:text-violet-300",
        },
      },
    ]);
  });

  it("omits agent identity for unknown agents and falls back for unknown colors", () => {
    expect(sessionsToRecents(sessions, [agents[0]])).toEqual([
      {
        id: "chat_1",
        label: "Q3 planning",
        agent: {
          name: "lawBOT",
          monogram: "L",
          badgeClassName: "bg-blue-500/15 text-blue-600 dark:text-blue-300",
        },
      },
      { id: "chat_2", label: "Untitled chat" },
    ]);
    expect(
      agentBadgeClass("neon"),
    ).toBe("bg-hover-2 text-ink-2");
    expect(agentBadgeClass(undefined)).toBe("bg-hover-2 text-ink-2");
  });

  it("derives the active title for the current chat", () => {
    expect(activeChatTitle("/chat/chat_1", sessions)).toBe("Q3 planning");
    expect(activeChatTitle("/chat/chat_2", sessions)).toBe("Untitled chat");
  });

  it("returns null on non-chat routes and unknown chats", () => {
    expect(activeChatTitle("/", sessions)).toBeNull();
    expect(activeChatTitle("/tools", sessions)).toBeNull();
    expect(activeChatTitle("/chat/unknown", sessions)).toBeNull();
    expect(activeChatTitle("/chat/chat_1/sub", sessions)).toBeNull();
  });
});
