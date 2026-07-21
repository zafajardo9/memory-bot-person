import { describe, expect, it } from "vitest";

import { convertToUIMessages } from "../../lib/utils";

describe("AI message migration", () => {
  it("preserves AI SDK 7 UI messages", () => {
    const message = {
      id: "message-1",
      role: "user" as const,
      parts: [{ type: "text" as const, text: "Hello" }],
    };

    expect(convertToUIMessages([message])).toEqual([message]);
  });

  it("converts legacy model messages and attaches tool results", () => {
    const converted = convertToUIMessages([
      { role: "user", content: "What is the weather?" },
      {
        role: "assistant",
        content: [
          { type: "text", text: "Checking now." },
          {
            type: "tool-call",
            toolCallId: "weather-1",
            toolName: "getWeather",
            args: { latitude: 14.6, longitude: 121 },
          },
        ],
      },
      {
        role: "tool",
        content: [
          {
            type: "tool-result",
            toolCallId: "weather-1",
            result: { temperature: 30 },
          },
        ],
      },
    ]);

    expect(converted[0]?.parts).toEqual([
      { type: "text", text: "What is the weather?" },
    ]);
    expect(converted[1]?.parts).toContainEqual(
      expect.objectContaining({
        type: "dynamic-tool",
        toolName: "getWeather",
        state: "output-available",
        output: { temperature: 30 },
      }),
    );
  });
});
