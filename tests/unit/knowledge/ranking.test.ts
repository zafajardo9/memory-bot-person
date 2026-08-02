import { describe, expect, it } from "vitest";

import {
  assembleHybridResults,
  reciprocalRankFusion,
} from "@/lib/knowledge/ranking";

describe("reciprocalRankFusion", () => {
  it("ranks an id appearing first in both lists highest", () => {
    const scores = reciprocalRankFusion([
      ["a", "b", "c"],
      ["a", "c", "b"],
    ]);
    expect(scores.get("a")).toBeGreaterThan(scores.get("b")!);
    expect(scores.get("a")).toBeGreaterThan(scores.get("c")!);
  });

  it("uses k=60 by default: first place contributes 1/61", () => {
    const scores = reciprocalRankFusion([["x"]]);
    expect(scores.get("x")).toBeCloseTo(1 / 61, 6);
  });

  it("sums contributions across lists for shared ids", () => {
    const scores = reciprocalRankFusion([
      ["a", "b"],
      ["b", "a"],
    ]);
    // a: 1/61 + 1/62 ; b: 1/62 + 1/61 -> equal
    expect(scores.get("a")).toBeCloseTo(scores.get("b")!, 9);
  });

  it("returns an empty map for no lists", () => {
    expect(reciprocalRankFusion([]).size).toBe(0);
  });
});

describe("assembleHybridResults", () => {
  const row = (id: string) => ({
    chunkId: id,
    sourceId: "s",
    versionId: "v",
    title: "t",
    content: "c",
    section: null,
    pageNumber: null,
    sourceUrl: null,
  });

  it("orders by fused score and caps at limit", () => {
    const vector = [row("a"), row("b"), row("c")];
    const fts = [row("b"), row("c"), row("a")];
    const out = assembleHybridResults(vector, fts, 2);
    // RRF (k=60): b=1/62+1/61, a=1/61+1/63, c=1/63+1/62 -> b > a > c
    expect(out.map((r) => r.chunkId)).toEqual(["b", "a"]);
    expect(out[0].score).toBeGreaterThan(out[1].score);
  });

  it("drops rows missing from both pools", () => {
    const out = assembleHybridResults([row("a")], [row("b")], 10);
    expect(out.map((r) => r.chunkId).sort()).toEqual(["a", "b"]);
  });
});
