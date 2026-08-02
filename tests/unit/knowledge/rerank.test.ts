import { describe, expect, it } from "vitest";

import {
  applyRerankScores,
  parseRerankResponse,
} from "@/lib/knowledge/rerank";

describe("parseRerankResponse", () => {
  it("parses id:score lines", () => {
    const scores = parseRerankResponse("aaa: 9\nbbb:2\nccc : 0");
    expect(scores).toEqual({ aaa: 9, bbb: 2, ccc: 0 });
  });

  it("ignores malformed lines and clamps to 0..10", () => {
    const scores = parseRerankResponse("abc: 42\njunk line\ndef: -3");
    expect(scores.abc).toBe(10);
    expect(scores.def).toBe(0);
    expect("junk" in scores).toBe(false);
  });

  it("accepts uuid-style ids", () => {
    const scores = parseRerankResponse(
      "11111111-2222-3333-4444-555555555555: 7",
    );
    expect(scores["11111111-2222-3333-4444-555555555555"]).toBe(7);
  });
});

describe("applyRerankScores", () => {
  const rows = [
    { chunkId: "a", score: 0.5 },
    { chunkId: "b", score: 0.4 },
  ];

  it("reorders by model score", () => {
    const out = applyRerankScores(rows, { b: 10, a: 1 });
    expect(out.map((r) => r.chunkId)).toEqual(["b", "a"]);
  });

  it("returns original order when no scores provided", () => {
    const out = applyRerankScores(rows, {});
    expect(out.map((r) => r.chunkId)).toEqual(["a", "b"]);
  });

  it("pushes unscored rows after scored ones", () => {
    const three = [...rows, { chunkId: "c", score: 0.9 }];
    const out = applyRerankScores(three, { a: 5 });
    expect(out[0].chunkId).toBe("a");
  });
});
