# Knowledge Bank — Production Diagnosis & Fix Plan

> Status: **fixes implemented and verified locally** (typecheck, 97 tests, build, `verify:knowledge` all green). Remaining: production upload verification (DoD items 1–2, 4).
> Scope: the Notebook / knowledge-bank pipeline (upload → ingest → embed → search).
> Symptom: works locally, breaks on Vercel production. Chat works; knowledge does not.

---

## 1. Why it works locally but breaks in production

The knowledge pipeline is **ingestion-heavy** and runs inside a Vercel **serverless
function**. The two environments differ in exactly the ways that break it:

| Concern | Local | Vercel production |
|---|---|---|
| Function timeout | None (runs to completion) | ~10s (Hobby) / 60s (Pro) hard kill |
| `maxDuration` override | n/a | **Not set anywhere in the app** → uses plan default |
| Network latency to DB + Gemini | Low (same machine / region) | Higher, per round-trip |
| Failed background work | You see it in the terminal | Silent — `after()` runs post-response, errors are swallowed |

### The root cause (the hot loop)

`processKnowledgeJob` (`lib/knowledge/ingestion.ts:183-211`) processes chunks
**sequentially**. For every single chunk it makes **3 sequential network calls**:

```
for each chunk:
  1. embedKnowledgeDocument(...)   → Gemini API call        (network)
  2. prisma.knowledgeChunk.create  → DB write               (network)
  3. prisma.$executeRaw UPDATE     → set embedding+tsvector (network)
```

A modest 30-chunk document = **~90+ sequential round-trips**. At even 150ms each
that is ~13.5s — past the Hobby timeout. Vercel **SIGKILLs the function mid-loop**,
so:

- the version never reaches `READY` / `APPROVED`,
- chunks have no `embedding`,
- retrieval (`retrieval.ts`) filters on `version.status = 'APPROVED'` and
  `chunk.embedding IS NOT NULL` → **returns zero rows**,
- the AI "searches" the Notebook and finds nothing.

Locally there is no timeout, so the same loop finishes and everything looks fine.

### Why chat still works

The chat route does not depend on ingestion completing. It streams fine; it just
has no approved, embedded knowledge to retrieve. So "chat works, knowledge
doesn't" is the expected signature of an **ingestion timeout**, not an auth or
routing problem.

---

## 2. Scan / check list (verify before & after fixing)

Run these to confirm the diagnosis and to validate the fix.

### A. Environment (Vercel → Project → Settings → Environment Variables)
- [ ] `DATABASE_URL` — points at the **production** Postgres (with `pgvector`).
- [ ] `IMAGEKIT_PRIVATE_KEY`, `IMAGEKIT_URL_ENDPOINT`, `IMAGEKIT_KNOWLEDGE_FOLDER`.
- [ ] Google provider key for embeddings — confirm `getProviderApiKey("google")`
      resolves in prod (stored in DB via AI provider settings, not just env).
- [ ] `KNOWLEDGE_MANAGEMENT_ENABLED` / `KNOWLEDGE_INDEXING_ENABLED` /
      `KNOWLEDGE_CHAT_ENABLED` — these default to **on** unless explicitly `"false"`.
      Confirm none are `"false"` in prod.
- [ ] `KNOWLEDGE_ALLOW_LOCAL_EMBEDDINGS` — should be **unset** in prod. In
      production, if Gemini fails, embedding **throws** (no silent fallback), which
      is correct — but it means a missing Google key = total ingestion failure.

### B. Database state (run against prod DB)
- [ ] `pgvector` extension installed: `SELECT extname FROM pg_extension WHERE extname='vector';`
- [ ] Migrations applied (incl. latest `add_research_depth_and_feedback`):
      `SELECT migration_name FROM _prisma_migrations ORDER BY finished_at DESC LIMIT 5;`
- [ ] Stuck jobs (the smoking gun):
      ```sql
      SELECT status, stage, count(*) FROM "KnowledgeIngestionJob" GROUP BY 1,2;
      ```
      Expect to see jobs frozen in `PROCESSING` / `embedding` if the timeout theory holds.
- [ ] Approved-but-empty sources:
      ```sql
      SELECT s.id, s.title, s.status, count(c.id) AS chunks
      FROM "KnowledgeSource" s
      LEFT JOIN "KnowledgeSourceVersion" v ON v.id = s."currentVersionId"
      LEFT JOIN "KnowledgeChunk" c ON c."versionId" = v.id AND c.embedding IS NOT NULL
      GROUP BY s.id, s.title, s.status;
      ```
      Sources with `status='APPROVED'` but `chunks=0` confirm ingestion died.

### C. Runtime logs (Vercel → Deployments → Functions → Logs)
- [ ] Filter for `Knowledge ingestion failed` and `ImageKit download failed`.
- [ ] Look for `Task timed out` / `FUNCTION_INVOCATION_FAILED` / `504` around upload time.
- [ ] Confirm the upload `POST /api/knowledge` returns `202` (it will — the failure
      happens *after* the response, in `after()`).

### D. Local reproduction
- [ ] `pnpm verify:knowledge` (scripts/verify-knowledge.ts) — end-to-end: migrate,
      ingest, approve, search. Should pass locally; use as the regression gate.
- [ ] `pnpm test` — 97 unit tests, includes retrieval/ranking/rerank.

---

## 3. The fix plan (ordered, retain what works)

Keep: DB schema, ImageKit storage, hybrid RRF retrieval, rerank, approval flow,
chat integration. Change only the ingestion hot path + deployment limits.

### Fix 1 — Raise the serverless time budget (highest leverage, lowest risk)
Add `export const maxDuration = 60;` (seconds) to the two routes that trigger
ingestion:
- `app/(chat)/api/knowledge/route.ts`
- `app/(chat)/api/knowledge/[id]/rescan/route.ts`

This alone moves the kill-line from ~10s to 60s. (Pro plan honors up to 300s;
Hobby caps at 60s.)

### Fix 2 — Parallelize embedding (remove the sequential bottleneck)
Replace the per-chunk `await` loop with **bounded concurrency** (e.g. 6 in flight).
Embedding calls are independent → run them with a small worker pool instead of one
at a time. Cuts the dominant cost ~6x.

### Fix 3 — Batch the DB writes (collapse N writes into ~1)
- Create all chunks with **one** `createMany` (embedding/tsvector stay null).
- Set vectors with **one** raw `UPDATE ... FROM (VALUES ...)` statement instead of
  N separate `$executeRaw` calls.
Reduces ~2N DB round-trips to ~2.

### Fix 4 — Make ingestion resumable / idempotent (so a timeout is recoverable)
The loop already deletes prior chunks for the version before starting
(`deleteMany` at line 181), so a re-run is safe. Add a lightweight **retry/recover**
path: a job found in `PROCESSING` on a later trigger resumes from scratch cleanly.
This protects against any remaining edge-case timeout.

### Fix 5 — Surface failures to the user (stop the silent failure)
`after()` swallows errors. Ensure a failed job writes `status='FAILED'` +
`errorMessage` (it already does in the catch block) **and** that the knowledge UI
polls job status and shows the error, so "it silently did nothing" becomes a
visible, actionable state.

### Fix 6 (optional, later) — Move heavy ingestion off the request path
For very large documents, the durable fix is a real queue (Vercel Queues /
Trigger.dev / a worker). Not required now — Fixes 1–3 bring typical documents well
under the 60s budget.

---

## 4. Definition of done

- [ ] Upload a multi-page PDF in **production** → job reaches `COMPLETED`,
      version `APPROVED`, chunks have embeddings (check list 2B query shows chunks > 0).
- [ ] Ask the agent a question answerable only from that doc → it retrieves and
      cites it (source cards appear, citation `【title — section】`).
- [x] `pnpm verify:knowledge` — end-to-end ingest → approve → search passes
      (verified locally after the fix).
- [x] `pnpm test` — 97/97 pass; `pnpm typecheck` clean; `pnpm build` succeeds.
- [ ] No `Task timed out` in Vercel logs for a normal-sized upload.

> **Bonus fix applied (second root cause):** `lib/prisma.ts` runs through Prisma
> Accelerate, which rejects interactive transactions with `timeout > 15s`
> (`P6005`). The `{ timeout: 30_000 }` on the ingestion success/catch
> transactions made the **catch block itself throw**, so failed jobs never got
> `status='FAILED'` + `errorMessage` — they stayed stuck in `PROCESSING`, exactly
> the prod symptom. Changed both to `{ timeout: 15_000 }` (legal Accelerate max,
> still above the 5s default that caused P2028).

---

## 5. Files involved

| File | Role | Change |
|---|---|---|
| `lib/knowledge/ingestion.ts` | Ingestion hot loop | Fix 2, 3, 4 |
| `app/(chat)/api/knowledge/route.ts` | Upload trigger | Fix 1 (`maxDuration`) |
| `app/(chat)/api/knowledge/[id]/rescan/route.ts` | Rescan trigger | Fix 1 (`maxDuration`) |
| `lib/knowledge/retrieval.ts` | Hybrid search | **No change** (works) |
| `lib/storage/imagekit.ts` | File storage | **No change** (works) |
| `components/knowledge/knowledge-manager.tsx` | UI | Fix 5 (show job errors) |
