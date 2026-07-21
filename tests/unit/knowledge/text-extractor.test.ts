import { describe, expect, it } from "vitest";

import { extractStructuredText } from "../../../lib/knowledge/extractors/text";

describe("extractStructuredText", () => {
  it("preserves Markdown headings as citation sections", () => {
    const document = extractStructuredText(
      "# Outline Work\nPrepare the weekly report.\n\n## Review\nAsk the lead to approve it.",
    );

    expect(document.sections).toEqual([
      { content: "Prepare the weekly report.", section: "Outline Work", sourceUrl: undefined },
      { content: "Ask the lead to approve it.", section: "Review", sourceUrl: undefined },
    ]);
  });
});
