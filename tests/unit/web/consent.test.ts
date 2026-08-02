import { describe, expect, it } from "vitest";

import {
  extractPublicUrls,
  hasWebResearchConsent,
  linkResearchIntent,
  linkToolPlan,
  webResearchInstruction,
} from "@/lib/web/consent";

import type { UIMessage } from "ai";

function message(role: "user" | "assistant", text: string): UIMessage {
  return {
    id: `${role}-${text}`,
    role,
    parts: [{ type: "text", text }],
  };
}

describe("web research consent", () => {
  it("treats a pasted public URL as permission to read that page", () => {
    expect(
      hasWebResearchConsent([
        message("user", "Can you explain https://example.com/guide?"),
      ]),
    ).toBe(true);
  });

  it("extracts unique public links without trailing punctuation", () => {
    expect(
      extractPublicUrls(
        "Read https://example.com/a, then https://example.com/a and https://example.org/b.",
      ),
    ).toEqual(["https://example.com/a", "https://example.org/b"]);
  });

  it("distinguishes focused summaries from deeper link research", () => {
    expect(
      linkResearchIntent("Summarize https://example.com/article").shouldExpandResearch,
    ).toBe(false);
    expect(
      linkResearchIntent("Discuss https://example.com/article in depth")
        .shouldExpandResearch,
    ).toBe(true);
  });

  it("detects an explicit request to remember a link", () => {
    expect(
      linkResearchIntent(
        "Remember https://example.com/architecture because it guides our migration.",
      ).shouldRemember,
    ).toBe(true);
  });

  it("plans deterministic link reading with browser and search fallbacks", () => {
    expect(
      linkToolPlan("Discuss https://example.com/article", {
        readWebPage: true,
        browseWebPage: true,
        webSearch: true,
      }),
    ).toMatchObject({
      reader: "readWebPage",
      expandWithSearch: true,
    });
    expect(
      linkToolPlan("Summarize https://example.com/app", {
        readWebPage: false,
        browseWebPage: true,
        webSearch: true,
      }),
    ).toMatchObject({
      reader: "browseWebPage",
      expandWithSearch: false,
    });
  });

  it("accepts a direct request to research the public web", () => {
    expect(
      hasWebResearchConsent([
        message("user", "Search the web for current AI regulations."),
      ]),
    ).toBe(true);
  });

  it("does not treat a request for current information as permission by itself", () => {
    expect(
      hasWebResearchConsent([
        message("user", "What are the latest developments in our market?"),
      ]),
    ).toBe(false);
  });

  it("accepts an affirmative reply to an assistant web-permission question", () => {
    expect(
      hasWebResearchConsent([
        message(
          "assistant",
          "I found the Notebook guidance. Would you like me to compare this with current web sources?",
        ),
        message("user", "Yes, please do."),
      ]),
    ).toBe(true);
  });

  it("does not treat an unrelated affirmative reply as web consent", () => {
    expect(
      hasWebResearchConsent([
        message("assistant", "Should I make that explanation shorter?"),
        message("user", "Yes, please do."),
      ]),
    ).toBe(false);
  });

  it("expires approval when the user moves to a new request", () => {
    expect(
      hasWebResearchConsent([
        message(
          "assistant",
          "Would you like me to compare this with current web sources?",
        ),
        message("user", "Proceed."),
        message("assistant", "Here is the comparison."),
        message("user", "Now summarize our onboarding process."),
      ]),
    ).toBe(false);
  });

  it("requires a structured comparison after approval", () => {
    const instruction = webResearchInstruction(true);
    expect(instruction).toContain("approved Notebook first");
    expect(instruction).toContain('"Notebook findings"');
    expect(instruction).toContain('"Current web findings"');
    expect(instruction).toContain('"Comparison"');
  });

  it("uses a proactive, synthesis-first instruction in Deep mode", () => {
    const instruction = webResearchInstruction(true, "", true);
    expect(instruction).toContain("DEEP RESEARCH MODE");
    expect(instruction).toContain("pre-approved and expected");
    expect(instruction).toContain("Synthesize, don't juxtapose");
    // Deep mode drops the rigid three-section separation in favor of synthesis.
    expect(instruction).not.toContain('"Notebook findings"');
  });

  it("still blocks web access in Deep mode when consent is not granted", () => {
    const instruction = webResearchInstruction(false, "", true);
    expect(instruction).toContain("web tools are unavailable");
  });

  it("routes supplied links through extraction, research, and explicit memory", () => {
    const instruction = webResearchInstruction(
      true,
      "Remember and analyze https://example.com/guide",
    );
    expect(instruction).toContain("MUST read every supplied URL");
    expect(instruction).toContain("Start with readWebPage");
    expect(instruction).toContain("use webSearch");
    expect(instruction).toContain("call saveUserMemory once");
  });
});
