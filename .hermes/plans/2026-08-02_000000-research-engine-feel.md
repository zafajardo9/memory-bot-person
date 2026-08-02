# Research-Engine Feel Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Make the chatbot *feel* like a genuine research engine — it decomposes the question, searches the approved Notebook deeply and iteratively, corroborates with the web, and shows that work live in the chat — so answers read as profound, well-sourced, and trustworthy rather than thin single-hit paraphrases.

**Architecture:** Four layers, built bottom-up so each stands on the last:
1. **Retrieval quality floor** — Reciprocal Rank Fusion (RRF) + a re-ranking stage in `lib/knowledge/retrieval.ts`, plus heading-enriched chunks, so the Notebook returns genuinely relevant evidence.
2. **Agentic research loop** — query decomposition + iterative gap-filling + a self-verification step, driven by the system prompt and the existing `stepCountIs(10)` budget in `ai/chat/stream-chat.ts`.
3. **Visible research** — a live, labeled research timeline and expandable source-evidence cards in the chat UI (extend `components/custom/assistant-activity.tsx`).
4. **Research depth control + learning loop** — a per-chat Quick/Deep toggle that replaces the tentative permission round-trip, plus gap capture and answer feedback wired to `KnowledgeQueryLog`.

**Tech Stack:** Next.js 16, Vercel AI SDK 7 (`streamText`, `stepCountIs`, `prepareStep`, tool parts), Prisma 7 + pgvector, Zod, Tailwind 4 / shadcn, Vitest.

---

## Current context / assumptions

- The pieces already exist: `searchCompanyKnowledge` / `readCompanyKnowledge` / `listCompanyKnowledgeSources` (`ai/knowledge-tools.ts`), web tools (`ai/tools/web-search.ts`), a consent gate (`lib/web/consent.ts`), a per-tool activity timeline (`components/custom/assistant-activity.tsx`), and query logging (`KnowledgeQueryLog` in `lib/knowledge/retrieval.ts:76`).
- The gap is **depth, iteration, and visibility**, not missing capabilities. The model currently does one retrieval hop and answers; tool calls render as generic activity; web research feels gated/optional.
- Hybrid score today is `0.65 * (1 - cosine) + 0.35 * ts_rank_cd` (`retrieval.ts:54`). `ts_rank_cd` returns values ~100× smaller than the vector term, so FTS is effectively dead weight. This plan fixes that with scale-free RRF.
- **Assumption:** no external re-ranking SaaS is required for v1. We implement a lightweight, dependency-free **LLM re-rank** using the already-resolved chat model (cheap, bounded to ~12 candidates). A cross-encoder SaaS (Cohere/Jina) is a documented future swap.
- **Assumption:** the re-rank LLM call and RRF run server-side inside the `searchCompanyKnowledge` tool so *both* the preflight and the model-driven tool call benefit without new plumbing.
- **Constraint (from user profile):** additive-only DB changes — new nullable columns / tables only, no drops, no required columns, no data loss. All schema tasks below honor this.
- Verify baseline before starting: `pnpm typecheck`, `pnpm test`, `pnpm lint` all green.

---

## Proposed approach (sequencing rationale)

Build retrieval quality first (Phase 1) because deeper orchestration is pointless if the Notebook returns weak hits. Then make the model research harder (Phase 2), then make that work visible (Phase 3), then remove friction and close the learning loop (Phase 4). Each phase is independently shippable and ends with a commit.

---

# Phase 1 — Retrieval quality floor

**Objective:** Make `searchCompanyKnowledge` return genuinely relevant, well-ranked evidence. Contained to `lib/knowledge/retrieval.ts` + chunking + one additive migration.

### Task 1.1: Add RRF score helper (pure function, TDD)

**Objective:** Replace the uncalibrated weighted sum with scale-free Reciprocal Rank Fusion over separate vector and FTS rankings.

**Files:**
- Create: `lib/knowledge/ranking.ts`
- Test: `tests/unit/knowledge/ranking.test.ts`

**Step 1: Write failing test**

```ts
// tests/unit/knowledge/ranking.test.ts
import { describe, expect, it } from "vitest";
import { reciprocalRankFusion } from "@/lib/knowledge/ranking";

describe("reciprocalRankFusion", () => {
  it("ranks an id appearing first in both lists highest", () => {
    const scores = reciprocalRankFusion([["a", "b", "c"], ["a", "c", "b"]]);
    expect(scores.get("a")).toBeGreaterThan(scores.get("b")!);
    expect(scores.get("a")).toBeGreaterThan(scores.get("c")!);
  });

  it("uses k=60 by default: first place contributes 1/61", () => {
    const scores = reciprocalRankFusion([["x"]]);
    expect(scores.get("x")).toBeCloseTo(1 / 61, 6);
  });

  it("sums contributions across lists for shared ids", () => {
    const scores = reciprocalRankFusion([["a", "b"], ["b", "a"]]);
    // a: 1/61 + 1/62 ; b: 1/62 + 1/61 -> equal
    expect(scores.get("a")).toBeCloseTo(scores.get("b")!, 9);
  });

  it("returns an empty map for no lists", () => {
    expect(reciprocalRankFusion([]).size).toBe(0);
  });
});
```

**Step 2: Run test to verify failure**

Run: `pnpm vitest run tests/unit/knowledge/ranking.test.ts`
Expected: FAIL — cannot resolve `@/lib/knowledge/ranking`.

**Step 3: Write minimal implementation**

```ts
// lib/knowledge/ranking.ts
export const RRF_K = 60;

/**
 * Scale-free Reciprocal Rank Fusion. Each input array is an ordered list of
 * chunk ids (best first) from one ranking signal. Returns id -> fused score.
 */
export function reciprocalRankFusion(
  rankedLists: string[][],
  k: number = RRF_K,
): Map<string, number> {
  const scores = new Map<string, number>();
  for (const list of rankedLists) {
    list.forEach((id, index) => {
      scores.set(id, (scores.get(id) ?? 0) + 1 / (k + index + 1));
    });
  }
  return scores;
}
```

**Step 4: Run test to verify pass**

Run: `pnpm vitest run tests/unit/knowledge/ranking.test.ts`
Expected: PASS (4 tests).

**Step 5: Commit**

```bash
git add lib/knowledge/ranking.ts tests/unit/knowledge/ranking.test.ts
git commit -m "feat(knowledge): add reciprocal rank fusion helper"
```

### Task 1.2: Retrieve two ranked lists and fuse in `searchCompanyKnowledge`

**Objective:** Run the vector query and the FTS query as two separate ordered candidate pools (each over a wider net, e.g. 20), fuse with RRF, and return the top `limit`.

**Files:**
- Modify: `lib/knowledge/retrieval.ts:44-74` (the `$queryRaw` block + score filter)

**Step 1: Write failing test**

Add to `tests/unit/knowledge/ranking.test.ts` a test for a new pure assembler:

```ts
import { assembleHybridResults } from "@/lib/knowledge/ranking";

describe("assembleHybridResults", () => {
  const row = (id: string) => ({
    chunkId: id, sourceId: "s", versionId: "v", title: "t",
    content: "c", section: null, pageNumber: null, sourceUrl: null,
  });

  it("orders by fused score and caps at limit", () => {
    const vector = [row("a"), row("b"), row("c")];
    const fts = [row("b"), row("c"), row("a")];
    const out = assembleHybridResults(vector, fts, 2);
    expect(out.map((r) => r.chunkId)).toEqual(["b", "c"]);
    expect(out[0].score).toBeGreaterThan(out[1].score);
  });

  it("drops rows missing from both pools", () => {
    const out = assembleHybridResults([row("a")], [row("b")], 10);
    expect(out.map((r) => r.chunkId).sort()).toEqual(["a", "b"]);
  });
});
```

**Step 2: Run test to verify failure**

Run: `pnpm vitest run tests/unit/knowledge/ranking.test.ts`
Expected: FAIL — `assembleHybridResults` not exported.

**Step 3: Write minimal implementation**

In `lib/knowledge/ranking.ts` add (import the `SearchRow`-shaped type locally or accept a generic with `chunkId`):

```ts
export interface RankableRow {
  chunkId: string;
  [key: string]: unknown;
}

export function assembleHybridResults<T extends RankableRow>(
  vectorRows: T[],
  ftsRows: T[],
  limit: number,
  k: number = RRF_K,
): (T & { score: number })[] {
  const byId = new Map<string, T>();
  for (const row of [...vectorRows, ...ftsRows]) {
    if (!byId.has(row.chunkId)) byId.set(row.chunkId, row);
  }
  const fused = reciprocalRankFusion([
    vectorRows.map((r) => r.chunkId),
    ftsRows.map((r) => r.chunkId),
  ], k);

  return [...fused.entries()]
    .map(([id, score]) => ({ ...(byId.get(id) as T), score }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
```

Then rewrite the query section of `searchCompanyKnowledge` (`retrieval.ts`) to issue two queries — one ordered by `chunk."embedding" <=> ${vector}::vector`, one ordered by `ts_rank_cd(...)` — each `LIMIT 20`, then `assembleHybridResults(vectorRows, ftsRows, limit)`. Keep the existing joins/where (APPROVED + currentVersion + agent assignment). Replace the old blended `score` column and the `0.15` floor with the RRF score; keep a minimal floor of `score > 0` (RRF scores are always > 0 for present ids).

**Step 4: Run test to verify pass**

Run: `pnpm vitest run tests/unit/knowledge/ranking.test.ts && pnpm typecheck`
Expected: PASS; no type errors.

**Step 5: Commit**

```bash
git add lib/knowledge/retrieval.ts lib/knowledge/ranking.ts tests/unit/knowledge/ranking.test.ts
git commit -m "feat(knowledge): hybrid retrieval via reciprocal rank fusion"
```

### Task 1.3: LLM re-rank stage (bounded, dependency-free)

**Objective:** After RRF pulls ~12 candidates, re-rank with one cheap model call that scores relevance 0–10 per chunk against the query; return the top `limit` reordered. Falls back gracefully to RRF order on any error.

**Files:**
- Create: `lib/knowledge/rerank.ts`
- Modify: `lib/knowledge/retrieval.ts` (call re-rank before logging/return)
- Test: `tests/unit/knowledge/rerank.test.ts`

**Step 1: Write failing test** (test the pure parsing/scoring, not the model call)

```ts
// tests/unit/knowledge/rerank.test.ts
import { describe, expect, it } from "vitest";
import { applyRerankScores, parseRerankResponse } from "@/lib/knowledge/rerank";

describe("parseRerankResponse", () => {
  it("parses id:score lines", () => {
    const scores = parseRerankResponse("abc: 9\ndef:2\nghi : 0");
    expect(scores).toEqual({ abc: 9, def: 2, ghi: 0 });
  });
  it("ignores malformed lines and clamps to 0..10", () => {
    const scores = parseRerankResponse("abc: 42\njunk line\ndef: -3");
    expect(scores.abc).toBe(10);
    expect(scores.def).toBe(0);
    expect("junk" in scores).toBe(false);
  });
});

describe("applyRerankScores", () => {
  const rows = [
    { chunkId: "a", score: 0.5 },
    { chunkId: "b", score: 0.4 },
  ];
  it("reorders by model score, keeps RRF order for unscored ids", () => {
    const out = applyRerankScores(rows, { b: 10, a: 1 });
    expect(out.map((r) => r.chunkId)).toEqual(["b", "a"]);
  });
  it("returns original order when no scores provided", () => {
    const out = applyRerankScores(rows, {});
    expect(out.map((r) => r.chunkId)).toEqual(["a", "b"]);
  });
});
```

**Step 2: Run test to verify failure**

Run: `pnpm vitest run tests/unit/knowledge/rerank.test.ts`
Expected: FAIL — module not found.

**Step 3: Write minimal implementation**

```ts
// lib/knowledge/rerank.ts
export function parseRerankResponse(text: string): Record<string, number> {
  const scores: Record<string, number> = {};
  for (const line of text.split("\n")) {
    const match = line.match(/^\s*([0-9a-f-]{8,})\s*:\s*(-?\d+(?:\.\d+)?)\s*$/i);
    if (!match) continue;
    scores[match[1]] = Math.max(0, Math.min(10, Number(match[2])));
  }
  return scores;
}

export function applyRerankScores<
  T extends { chunkId: string; score: number },
>(rows: T[], scores: Record<string, number>): T[] {
  if (Object.keys(scores).length === 0) return rows;
  return [...rows].sort((a, b) => {
    const sa = scores[a.chunkId];
    const sb = scores[b.chunkId];
    if (sa === undefined && sb === undefined) return b.score - a.score;
    if (sa === undefined) return 1;
    if (sb === undefined) return -1;
    return sb - sa;
  });
}
```

Then add a `rerankWithModel(query, candidates, model)` function in the same file that: builds a prompt listing `chunkId: first ~400 chars`, calls `generateText({ model, prompt })`, parses with `parseRerankResponse`, and returns `applyRerankScores(...)`. Wrap the whole thing in try/catch → on error return candidates unchanged. In `retrieval.ts`, accept an optional `rerankModel?: LanguageModel` param and, when present, run re-rank over the RRF top ~12 before slicing to `limit`.

**Step 4: Run test to verify pass**

Run: `pnpm vitest run tests/unit/knowledge/rerank.test.ts && pnpm typecheck`
Expected: PASS.

**Step 5: Commit**

```bash
git add lib/knowledge/rerank.ts lib/knowledge/retrieval.ts tests/unit/knowledge/rerank.test.ts
git commit -m "feat(knowledge): add bounded LLM re-rank stage with graceful fallback"
```

### Task 1.4: Wire the re-rank model through from the chat orchestrator

**Objective:** Pass the resolved chat model into `searchCompanyKnowledge` so re-ranking uses an available credential, and widen the default tool `limit` so re-ranking has material.

**Files:**
- Modify: `ai/knowledge-tools.ts:24-31` (pass `rerankModel`)
- Modify: `ai/chat/stream-chat.ts:48-54` (preflight passes model)
- Modify: `lib/knowledge/validation.ts:35` (`knowledgeSearchSchema` default `limit` 6 → 8, max stays 10)

**Step 1:** Thread `rerankModel` into `createKnowledgeTools({ ..., model })` and forward to `searchCompanyKnowledge`. Update `createChatTools` (`ai/tools/index.ts`) to pass `input.model`.
**Step 2:** In `stream-chat.ts` `knowledgePreflight`, pass `rerankModel: selected.model` (preflight already runs a search; it now benefits too).
**Step 3:** Bump schema default limit to 8.
**Step 4: Verify** — Run: `pnpm typecheck && pnpm test` Expected: green.
**Step 5: Commit**

```bash
git add ai/knowledge-tools.ts ai/tools/index.ts ai/chat/stream-chat.ts lib/knowledge/validation.ts
git commit -m "feat(knowledge): wire re-rank model through search and preflight"
```

### Task 1.5: Heading-enriched chunk text (additive)

**Objective:** Improve retrieval for short/ambiguous sections by embedding the heading path, and make citations more meaningful.

**Files:**
- Modify: `lib/knowledge/chunking.ts` (prepend section path to embedded content — but keep stored `content` clean; add a separate `embeddingText`)
- Modify: `lib/knowledge/types.ts` (`KnowledgeChunkInput` gains optional `embeddingText?: string`)
- Modify: `lib/knowledge/ingestion.ts:185` (embed `chunk.embeddingText ?? chunk.content`)
- Test: `tests/unit/knowledge/chunking.test.ts` (extend existing)

**Step 1: Write failing test**

```ts
it("prepends the section heading to embeddingText but not content", () => {
  const chunks = chunkSections([
    { content: "Short body.", section: "Onboarding > IT Setup" },
  ]);
  expect(chunks[0].content).toBe("Short body.");
  expect(chunks[0].embeddingText).toContain("Onboarding > IT Setup");
  expect(chunks[0].embeddingText).toContain("Short body.");
});
```

**Step 2: Run** — `pnpm vitest run tests/unit/knowledge/chunking.test.ts` Expected: FAIL.
**Step 3: Implement** — in `chunkSections`, when pushing a chunk set `embeddingText: section.section ? \`${section.section}\n\n${content}\` : content`.
**Step 4: Run** — `pnpm vitest run tests/unit/knowledge/chunking.test.ts && pnpm typecheck` Expected: PASS.
**Step 5: Commit**

```bash
git add lib/knowledge/chunking.ts lib/knowledge/types.ts lib/knowledge/ingestion.ts tests/unit/knowledge/chunking.test.ts
git commit -m "feat(knowledge): enrich embeddings with section heading path"
```

> Note: existing indexed chunks keep working; new/rescanned sources get the enriched embedding. No backfill required (additive, no data loss). Document that a rescan picks up the improvement.

---

# Phase 2 — Agentic research loop

**Objective:** Make the model research *iteratively* — decompose, retrieve per sub-question, detect gaps, retrieve again, then self-verify — using the existing `stepCountIs(10)` budget. Mostly prompt + light orchestration.

### Task 2.1: Add a research-protocol section to the system prompt

**Objective:** Instruct decomposition, iterative gap-filling, and a pre-answer verification step.

**Files:**
- Modify: `ai/prompts/company-assistant.ts`

**Step 1:** Insert a `RESEARCH PROTOCOL` block after the `SOURCE-OF-TRUTH RULES` block:

```text
RESEARCH PROTOCOL (follow for any non-trivial question):
1. Decompose: silently split a complex question into 2-4 concrete sub-questions.
2. Retrieve each: call searchCompanyKnowledge once per sub-question with a focused query, not one vague query.
3. Read deeper: call readCompanyKnowledge for the most relevant chunks before relying on a passage.
4. Gap check: before answering, ask whether every sub-question has supporting evidence. If any is unanswered or thin, run another targeted search (Notebook first, then web if approved) instead of answering from partial evidence.
5. Verify: confirm each claim maps to a retrieved passage; do not state company facts you cannot cite. Surface conflicts instead of resolving them silently.
6. Synthesize: answer from the combined evidence across sub-questions, not from a single passage. Cite every company-specific claim with 【source title — section or page】.
Skip decomposition for simple factual lookups that one search clearly answers.
```

**Step 2: Verify** — Run: `pnpm typecheck && pnpm lint` Expected: green.
**Step 3: Commit**

```bash
git add ai/prompts/company-assistant.ts
git commit -m "feat(prompt): add iterative research protocol (decompose, gap-fill, verify)"
```

### Task 2.2: Raise the step budget and keep knowledge tools active across steps

**Objective:** Ensure the model has room to decompose + iterate without hitting the cap mid-research.

**Files:**
- Modify: `ai/chat/stream-chat.ts:119` (`stepCountIs(10)` → `stepCountIs(12)`)
- Modify: `ai/chat/stream-chat.ts:121-135` (`prepareStep` — only force web tools on link turns; never restrict knowledge tools)

**Step 1:** Bump to `stepCountIs(12)`. Confirm `prepareStep` returns `{}` (all tools available) on non-link turns so the model can freely loop knowledge searches. (Current logic already returns `{}` except for link plans — verify and leave a comment.)
**Step 2: Verify** — `pnpm typecheck` Expected: green.
**Step 3: Commit**

```bash
git add ai/chat/stream-chat.ts
git commit -m "feat(chat): give the research loop more steps and unrestricted knowledge tools"
```

### Task 2.3: Make preflight encourage decomposition, not a forced duplicate search

**Objective:** Today preflight runs a search AND the prompt forces another tool call — double cost. Reframe preflight output to seed decomposition.

**Files:**
- Modify: `ai/chat/stream-chat.ts:34-64` (`knowledgePreflight`)

**Step 1:** Change the injected text so that when candidates are found it says: *"Preflight found relevant approved sources (below). Use them to plan focused sub-queries; you must still call the knowledge tools to gather evidence before answering."* When none found, keep the existing "do not invent policy" line. This removes the implication that the model must re-run the *same* query.
**Step 2: Verify** — `pnpm typecheck && pnpm test` Expected: green.
**Step 3: Commit**

```bash
git add ai/chat/stream-chat.ts
git commit -m "refactor(chat): preflight seeds decomposition instead of forcing duplicate search"
```

---

# Phase 3 — Visible research in the chat

**Objective:** Turn the real research steps into a first-class, labeled timeline + expandable source-evidence cards, so users *see* the system researching. Builds on the existing `assistant-activity.tsx`.

### Task 3.1: Show Notebook evidence cards for knowledge tool output

**Objective:** `searchCompanyKnowledge` / `readCompanyKnowledge` currently render `null` in `ToolOutput` (`assistant-activity.tsx:291-296`). Render compact, expandable source cards with the retrieved snippet, citation, and score.

**Files:**
- Modify: `components/custom/assistant-activity.tsx` (replace the `return null` branch; add a `KnowledgeOutput` component)
- Test: `tests/unit/ai/assistant-activity.test.ts` (extend)

**Step 1: Write failing test** — assert a new exported helper `summarizeKnowledgeOutput(output)` returns `{ count, sources: [{ citation, snippet, score }] }` given a shaped tool output, and `null` for non-records.

```ts
import { summarizeKnowledgeOutput } from "@/components/custom/assistant-activity";

it("summarizes search results into source cards", () => {
  const out = summarizeKnowledgeOutput({
    results: [
      { citation: "IT Guide — page 2", content: "Provision a laptop…", score: 0.03 },
      { citation: "HR Policy — Onboarding", content: "First week…", score: 0.02 },
    ],
  });
  expect(out?.count).toBe(2);
  expect(out?.sources[0].citation).toBe("IT Guide — page 2");
});
```

**Step 2: Run** — `pnpm vitest run tests/unit/ai/assistant-activity.test.ts` Expected: FAIL.
**Step 3: Implement** — export `summarizeKnowledgeOutput` (pure, guards with `isRecord`, slices to 5, snippet = first ~160 chars). Render a `KnowledgeOutput` card list styled like the existing `WebSearchOutput` (left border, citation title, line-clamped snippet, small score badge). Wire it into `ToolOutput` for the two knowledge tools.
**Step 4: Run** — `pnpm vitest run tests/unit/ai/assistant-activity.test.ts && pnpm typecheck` Expected: PASS.
**Step 5: Commit**

```bash
git add components/custom/assistant-activity.tsx tests/unit/ai/assistant-activity.test.ts
git commit -m "feat(ui): render Notebook source-evidence cards for knowledge tool calls"
```

### Task 3.2: Group the timeline under a "Researching…" header with a live count

**Objective:** Make the activity block read as a single research session ("Researched 6 sources") rather than a flat list of tool calls.

**Files:**
- Modify: `components/custom/assistant-activity.tsx` (the `AssistantActivity` root — read the remaining lines `offset=501` before editing)

**Step 1:** Read the rest of the file: `read_file components/custom/assistant-activity.tsx offset=501`.
**Step 2:** Add a header row above the tool list when there is ≥1 knowledge/web tool part: an icon + `isActive ? "Researching…" : "Researched N sources"`, where N = distinct source titles across knowledge + web outputs. Keep individual tool rows beneath it (indent the existing timeline).
**Step 3: Verify** — `pnpm typecheck && pnpm lint` Expected: green. Manual: run `pnpm dev`, ask a work question, confirm the header + cards render.
**Step 4: Commit**

```bash
git add components/custom/assistant-activity.tsx
git commit -m "feat(ui): group activity under a live 'Researching…' header with source count"
```

### Task 3.3: Add a collapsible "How I verified this" section to the answer

**Objective:** After the answer, surface the agreement/conflict/coverage summary the research protocol produces, so profundity and rigor are visible.

**Files:**
- Modify: `components/custom/message.tsx` (add a `<details>` block after the answer when citations `【…】` are present)
- Modify: `ai/prompts/company-assistant.ts` (instruct the model to end multi-source answers with a short `### How I verified this` block)

**Step 1:** In the prompt, add: *"When you used more than one source, end with a short '### How I verified this' section noting where sources agreed, conflicted, or left gaps."*
**Step 2:** In `message.tsx`, no special parsing needed — the block is just markdown rendered by `ChatMarkdown`. Optionally wrap trailing verification heading in a subtle bordered callout. Keep minimal (YAGNI): rely on markdown rendering first.
**Step 3: Verify** — `pnpm typecheck && pnpm lint`. Manual: multi-source question shows the section.
**Step 4: Commit**

```bash
git add ai/prompts/company-assistant.ts components/custom/message.tsx
git commit -m "feat: surface a 'How I verified this' provenance section in answers"
```

---

# Phase 4 — Research depth control + learning loop

**Objective:** Remove the tentative permission round-trip with an explicit Quick/Deep toggle, and make the system learn from gaps and feedback.

### Task 4.1: Add a per-chat `researchDepth` field (additive migration)

**Objective:** Persist a Quick/Deep preference per chat.

**Files:**
- Modify: `prisma/schema.prisma` (add `researchDepth String? @default("quick")` to the `Chat` model — nullable, additive)
- Create: migration via `pnpm db:migrate` (name: `add_chat_research_depth`)
- Modify: `db/queries.ts` (`saveChat` accepts/persists `researchDepth`)

**Step 1:** Add the nullable column to the `Chat` model. Run: `pnpm db:migrate` Expected: migration created + applied locally.
**Step 2:** Thread `researchDepth` through `saveChat` (optional param; ignore if undefined).
**Step 3: Verify** — `pnpm typecheck && pnpm test` Expected: green.
**Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations db/queries.ts
git commit -m "feat(db): add nullable Chat.researchDepth (quick/deep)"
```

### Task 4.2: Deep mode auto-grants web corroboration (replaces permission round-trip)

**Objective:** When `researchDepth === "deep"`, treat web research as pre-approved so the system corroborates proactively; Quick keeps Notebook-only.

**Files:**
- Modify: `ai/chat/stream-chat.ts` (compute `webAccessApproved = hasWebResearchConsent(messages) || researchDepth === "deep"`)
- Modify: `lib/web/consent.ts` (`webResearchInstruction` — add a Deep-mode variant that skips the "ask permission" line and instructs proactive corroboration)
- Modify: `app/(chat)/api/chat/route.ts` (read `researchDepth` from the chat record and pass into `streamCompanyChat`)

**Step 1:** Load the chat's `researchDepth` in the route, pass to `streamCompanyChat`, and OR it into `webAccessApproved`.
**Step 2:** Add a Deep-mode branch to `webResearchInstruction` that says web corroboration is expected and to integrate findings (not just juxtapose).
**Step 3: Verify** — `pnpm typecheck && pnpm test` (extend `tests/unit/web/consent.test.ts` with a Deep-mode case). Expected: green.
**Step 4: Commit**

```bash
git add ai/chat/stream-chat.ts lib/web/consent.ts app/(chat)/api/chat/route.ts tests/unit/web/consent.test.ts
git commit -m "feat(web): Deep research mode auto-corroborates with the web"
```

### Task 4.3: Research-depth toggle in the chat UI

**Objective:** Let the user switch Quick/Deep above the composer.

**Files:**
- Modify: `components/custom/multimodal-input.tsx` (add a compact Quick/Deep toggle; read the existing component first)
- Modify: `components/custom/chat.tsx` (hold `researchDepth` state, send it in the chat request body, persist via the existing save flow)
- Modify: `app/(chat)/api/chat/route.ts` (accept optional `researchDepth` in `chatRequestSchema`)

**Step 1:** Read `components/custom/multimodal-input.tsx` and `components/custom/chat.tsx`.
**Step 2:** Add a small two-state toggle (Quick ⚡ / Deep 🔎) near the model selector; on change, PATCH the chat's `researchDepth` (reuse `saveChat`/an existing chat update path) and update local state.
**Step 3:** Extend `chatRequestSchema` with `researchDepth: z.enum(["quick","deep"]).optional()`.
**Step 4: Verify** — `pnpm typecheck && pnpm lint`. Manual: toggle persists across reload and Deep mode triggers web corroboration.
**Step 5: Commit**

```bash
git add components/custom/multimodal-input.tsx components/custom/chat.tsx app/(chat)/api/chat/route.ts
git commit -m "feat(ui): add Quick/Deep research-depth toggle to the composer"
```

### Task 4.4: Capture zero-result gaps + answer feedback (additive)

**Objective:** Turn `KnowledgeQueryLog` from write-only into a learning signal: flag zero-result queries and store thumbs up/down tied to retrieved chunks.

**Files:**
- Modify: `prisma/schema.prisma` (add nullable `feedback Int?` to `KnowledgeQueryLog`; additive)
- Create: `app/(chat)/api/knowledge-feedback/route.ts` (POST: `{ queryLogId, feedback: 1 | -1 }`, auth-gated, owner-only)
- Modify: `lib/knowledge/retrieval.ts` (when `results.length === 0`, mark the log row — e.g. a nullable `hadResults Boolean?` or reuse `resultCount`)
- Modify: `components/custom/message.tsx` (add 👍/👎 on assistant answers that POST feedback)

**Step 1:** Add nullable `feedback Int?` to `KnowledgeQueryLog`; `pnpm db:migrate`.
**Step 2:** Create the feedback route (validate session, verify the log belongs to the user, update `feedback`).
**Step 3:** Add 👍/👎 buttons to the assistant answer; on click POST to the route with the most recent `queryLogId` for the chat (return `queryLogId` from the search tool output or look up latest by chatId).
**Step 4: Verify** — `pnpm typecheck && pnpm test` (add a route unit test for auth/owner checks). Manual: feedback persists.
**Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations app/(chat)/api/knowledge-feedback/route.ts lib/knowledge/retrieval.ts components/custom/message.tsx
git commit -m "feat(knowledge): capture answer feedback and zero-result gaps"
```

### Task 4.5: Admin "knowledge gaps" view

**Objective:** Surface unanswered questions and low-rated sources so the team knows what to add — the compounding part.

**Files:**
- Create: `app/(admin)/knowledge/gaps/page.tsx` (admin-only list: zero-result queries grouped + count, and queries with `feedback = -1`)
- Create: `app/(chat)/api/knowledge/gaps/route.ts` (admin-gated aggregation query)

**Step 1:** Read an existing admin page for the pattern: `read_file app/(admin)/knowledge/page.tsx`.
**Step 2:** Add the aggregation route (group `KnowledgeQueryLog` by `query` where `resultCount = 0` or `feedback = -1`, order by count desc, limit 50).
**Step 3:** Build the page (table: query, zero-hit count, negative feedback count, last asked).
**Step 4: Verify** — `pnpm typecheck && pnpm lint`. Manual: as admin, view `/knowledge/gaps`.
**Step 5: Commit**

```bash
git add app/(admin)/knowledge/gaps/page.tsx app/(chat)/api/knowledge/gaps/route.ts
git commit -m "feat(admin): knowledge gaps dashboard from query logs and feedback"
```

---

## Files likely to change (summary)

```text
lib/knowledge/ranking.ts            (new) RRF + hybrid assembler
lib/knowledge/rerank.ts             (new) LLM re-rank + pure parsers
lib/knowledge/retrieval.ts          RRF retrieval, re-rank wiring, feedback/gap fields
lib/knowledge/chunking.ts           heading-enriched embeddingText
lib/knowledge/types.ts              embeddingText field
lib/knowledge/ingestion.ts          embed embeddingText
lib/knowledge/validation.ts         search default limit 6 -> 8
lib/web/consent.ts                  Deep-mode instruction variant
ai/prompts/company-assistant.ts     research protocol + verification section
ai/chat/stream-chat.ts              step budget, preflight reframe, deep mode
ai/knowledge-tools.ts               pass re-rank model
ai/tools/index.ts                   forward model to knowledge tools
app/(chat)/api/chat/route.ts        researchDepth in schema + load
app/(chat)/api/knowledge-feedback/route.ts   (new)
app/(chat)/api/knowledge/gaps/route.ts       (new, admin)
app/(admin)/knowledge/gaps/page.tsx          (new, admin)
components/custom/assistant-activity.tsx     source cards + Researching header
components/custom/message.tsx                verification section + feedback buttons
components/custom/multimodal-input.tsx       Quick/Deep toggle
components/custom/chat.tsx                   researchDepth state
prisma/schema.prisma                Chat.researchDepth, KnowledgeQueryLog.feedback
tests/unit/knowledge/ranking.test.ts         (new)
tests/unit/knowledge/rerank.test.ts          (new)
tests/unit/knowledge/chunking.test.ts        (extend)
tests/unit/ai/assistant-activity.test.ts     (extend)
tests/unit/web/consent.test.ts               (extend)
```

## Tests / validation

- Unit (Vitest): `pnpm test` — new suites for `ranking`, `rerank`, plus extended `chunking`, `assistant-activity`, `consent`.
- Types: `pnpm typecheck` after every phase.
- Lint: `pnpm lint`.
- Retrieval smoke (real DB): `pnpm verify:knowledge` — confirms index → approve → retrieve still works after RRF/re-rank changes.
- Manual end-to-end: `pnpm dev`, then:
  1. Ask a multi-part work question in **Deep** mode → expect a "Researching…" timeline, multiple labeled searches, source-evidence cards, an integrated answer with 【citations】, and a "How I verified this" section.
  2. Ask something the Notebook lacks → expect an honest "not found" + (Deep) web corroboration clearly separated.
  3. 👎 an answer → confirm it appears in `/knowledge/gaps`.

## Risks, tradeoffs, and open questions

- **Latency:** decomposition + re-rank + extra steps add latency. Mitigations: re-rank is one bounded call over ~12 items; the visible timeline makes waiting feel productive; Quick mode skips web. *Open:* consider streaming the re-rank decision or caching embeddings per query.
- **Re-rank cost/quality:** v1 uses the chat model for re-ranking. *Open:* swap to a cross-encoder SaaS (Cohere/Jina) behind the same `rerank.ts` interface if quality/latency needs it.
- **RRF floor:** dropping the `0.15` threshold means low-relevance ids can surface; re-ranking + the model's "say not found" rule are the real guards. Watch zero-result vs noisy-result rates via the gaps dashboard.
- **Deep mode + web quota:** proactive corroboration burns `WEB_SEARCH_MAX_DAILY` faster. *Open:* consider a separate Deep-mode quota or per-chat cap.
- **Prompt length:** the research protocol + verification instructions grow the system prompt. Keep wording tight; measure token usage.
- **Schema:** all changes are additive/nullable per the user's migration policy — no data loss, no required columns.
- **Scope guard (YAGNI):** this plan deliberately excludes OCR, authenticated-site ingestion, and a standalone "deep research" long-running job — those are future work, not part of the feel upgrade.
