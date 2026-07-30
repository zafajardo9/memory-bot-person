# Sustainable Memory, Context, and Knowledge Implementation Plan

> **Status**: [x] Planning | [ ] In Progress | [ ] Implemented | [ ] Archived
>
> **Created**: 2026-07-30
>
> **Implemented**: —
>
> **Source specification**: [`docs/memory-context-knowledge-sustainability.md`](../../docs/memory-context-knowledge-sustainability.md)
>
> **Quick Checklist**:
> - [x] Requirements gathered
> - [x] Codebase analyzed
> - [ ] Database changes reviewed
> - [ ] Backend changes implemented
> - [ ] Frontend changes implemented
> - [ ] Tests passing
> - [ ] Security reviewed
> - [ ] Deployed

## 1. Goal

Build a bounded, provenance-aware, relevance-driven memory and context system with recoverable knowledge ingestion, measurable grounding quality, and user-controlled data lifecycles.

## 2. Context Summary

### Confirmed repository facts

- The application uses Next.js 16, React 19, TypeScript, Prisma 7, PostgreSQL, and pgvector.
- Chat messages are stored as one JSON value in `Chat.messages`; `Chat` currently has no durable context summary or `updatedAt` field.
- Each authenticated user can have durable `UserMemory` records with a title, content, tags, category, priority, source, and timestamps.
- Personal-memory lookup currently uses case-insensitive substring matching and tag equality.
- The personal-memory preflight currently loads the 15 highest-priority and most recently updated entries.
- Personal-memory preflight caching uses a process-local `Map`, so invalidation is not shared across application instances.
- Automatic memory extraction runs after a completed response and extracts from the latest completed user/assistant exchange.
- Automatic memory deduplication currently depends on case-insensitive title equality.
- Chat orchestration currently sends the converted message collection to the model without a central context budget or conversation compaction layer.
- The memory middleware is applied only when the selected model is not represented by a string.
- Company knowledge already has sources, immutable versions, chunks, ingestion jobs, audit events, and query logs.
- Company knowledge uses 768-dimensional embeddings and PostgreSQL full-text search.
- Knowledge retrieval currently combines vector and full-text scores with fixed weights and a fixed threshold.
- Chat orchestration performs a knowledge preflight search while the prompt also requires the model to call the knowledge search tool, allowing duplicate initial retrieval.
- Knowledge ingestion is launched with Next.js `after()` and embeds chunks sequentially.
- Existing feature flags independently control user memory, automatic extraction, knowledge management, indexing, and knowledge chat.
- Existing tests are primarily unit tests; there is no comprehensive evaluation corpus for retrieval, grounding, memory correction, or long-context compaction.
- The worktree contains active user changes. Implementation must preserve unrelated modifications and avoid broad rewrites.

### Assumptions for this plan

- PostgreSQL remains the durable source of truth.
- pgvector remains available in development and production.
- The first implementation continues to support one logical company workspace while making new records workspace-ready.
- The existing provider abstraction remains in place; summarization and extraction must work with any selected chat provider that supports structured output.
- A PostgreSQL-backed worker claim loop will be used first so durable jobs do not require a new queue vendor.
- Context traces will store identifiers, scores, token counts, versions, and timings—not full prompts or sensitive memory content.
- Existing chats and memories must continue to work after migrations through safe backfills and defaults.
- The rollout will use feature flags and shadow evaluation before new selection behavior becomes authoritative.
- Manual user memories remain more authoritative than automatically extracted memories.
- Company knowledge remains more authoritative than general model knowledge for company-specific claims.

### Open decisions to resolve before implementation

- [ ] Confirm the maximum target prompt budget for each supported model family.
- [ ] Confirm the production worker trigger: dedicated long-running process, scheduled HTTP invocation, or hosting-provider cron.
- [ ] Confirm retention durations for chats, context traces, automatic memories, query logs, archived versions, and original files.
- [ ] Confirm whether workspace membership and role-based source visibility are required in the first production rollout or can remain schema-ready behind a flag.
- [ ] Confirm whether health-related personal memories are always prohibited or permitted only through explicit manual opt-in.
- [ ] Confirm the initial source review interval, suggested default: 180 days.
- [ ] Confirm whether user-visible “why this memory was used” explanations may include a short source excerpt.

These decisions do not block Phase 0 or the additive schema design. Defaults must be documented in configuration until product decisions replace them.

## 3. Scope

- A central context assembler with deterministic section ordering and hard token budgets.
- A recent-message window plus durable incremental conversation summaries.
- Context selection traces without raw prompt persistence.
- Personal-memory lifecycle states, canonical keys, provenance, confidence, validity, supersession, pinning, and usage data.
- Idempotent automatic memory extraction with explicit create/refine/supersede/ignore/confirm operations.
- Hybrid personal-memory retrieval using semantic, keyword, priority, validity, and recency signals.
- Elimination of correctness dependence on the process-local memory cache.
- One initial company-knowledge retrieval per turn.
- Improved hybrid knowledge ranking, result diversity, confidence states, and optional reranking.
- PostgreSQL-backed durable ingestion job claiming, retries, leases, heartbeats, and recovery.
- Batch embeddings and content-addressed chunk reuse.
- Versioned extractor, chunker, embedding, and retrieval configurations.
- Workspace-ready source governance, ownership, audience, authority, effective dates, expiry dates, and review dates.
- User controls for inspecting, pinning, correcting, and forgetting memories.
- Privacy-safe export and deletion paths.
- A version-controlled evaluation corpus, automated metrics, rollout gates, and operational documentation.

## 4. Out of Scope

- Fine-tuning a language model.
- Replacing PostgreSQL or pgvector.
- Replacing the existing authentication system.
- Fully autonomous modification or approval of company knowledge.
- Letting automatic extraction store credentials, secrets, authentication data, or financial account data.
- Cross-user personal-memory sharing.
- A general-purpose workflow engine beyond memory extraction, summarization, maintenance, and knowledge ingestion jobs.
- Building a vendor-specific analytics warehouse in the first release.
- Deleting old chat messages merely because they were summarized.
- Migrating every existing user into a full organization-management UI during the initial context work.
- Implementing all phases in one deployment.

## 5. Affected Files and Folders

```txt
app/
  (chat)/
    api/
~     chat/route.ts
~     user-memory/route.ts
+     user-memory/[id]/route.ts
+     user-memory/export/route.ts
~     knowledge/route.ts
~     knowledge/[id]/rescan/route.ts
+     internal/context-maintenance/route.ts
+     internal/knowledge-worker/route.ts
    settings/
      agent/
~       page.tsx
ai/
  chat/
~   stream-chat.ts
  memory/
~   extraction.ts
+   extraction-schema.ts
+   summarization.ts
~ custom-middleware.ts
~ knowledge-tools.ts
~ prompts/company-assistant.ts
  tools/
~   user-memory.ts
components/
  settings/
~   agent-settings.tsx
+   memory-detail.tsx
+   memory-source-badge.tsx
+   memory-status-actions.tsx
db/
~ memory-queries.ts
~ knowledge-queries.ts
+ chat-context-queries.ts
+ context-trace-queries.ts
+ maintenance-job-queries.ts
lib/
  context/
+   assembler.ts
+   budget.ts
+   message-window.ts
+   token-estimator.ts
+   trace.ts
  memory/
~   cache.ts
~   config.ts
~   preflight.ts
+   canonicalization.ts
+   retrieval.ts
+   scoring.ts
+   lifecycle.ts
+   privacy.ts
+   types.ts
  knowledge/
~   chunking.ts
~   embeddings.ts
~   ingestion.ts
~   retrieval.ts
+   ranking.ts
+   versions.ts
+   worker.ts
+   maintenance.ts
  jobs/
+   claim.ts
+   retry.ts
+   types.ts
prisma/
~ schema.prisma
  migrations/
+   <timestamp>_context_snapshots/
+   <timestamp>_personal_memory_lifecycle/
+   <timestamp>_context_traces/
+   <timestamp>_durable_maintenance_jobs/
+   <timestamp>_content_addressed_chunks/
+   <timestamp>_knowledge_governance/
scripts/
+ run-maintenance-worker.ts
+ evaluate-memory-context.ts
+ verify-context-assembly.ts
tests/
  fixtures/
+   memory-context-evaluation/
  unit/
    ai/
~     memory-extraction.test.ts
+     conversation-summary.test.ts
    memory/
~     cache.test.ts
+     canonicalization.test.ts
+     lifecycle.test.ts
+     retrieval.test.ts
+   context/
+     assembler.test.ts
+     budget.test.ts
+     message-window.test.ts
    knowledge/
~     chunking.test.ts
+     ranking.test.ts
+     incremental-indexing.test.ts
+   jobs/
+     claim.test.ts
+     retry.test.ts
  integration/
+   context-assembly.test.ts
+   memory-lifecycle.test.ts
+   conversation-compaction.test.ts
+   knowledge-worker.test.ts
+   privacy-deletion.test.ts
  e2e/
+   memory-controls.spec.ts
+   long-conversation.spec.ts
+   grounded-company-answer.spec.ts
docs/
~ memory-context-knowledge-sustainability.md
~ knowledge-administration.md
+ memory-and-context-operations.md
+ memory-privacy-and-retention.md
.env.example
~ README.md
~ package.json
```

### Important path notes

- `lib/context/assembler.ts` becomes the only place that decides what durable and recent context reaches the model.
- `ai/chat/stream-chat.ts` remains the orchestration entrypoint but delegates selection and budgeting to the context assembler.
- `ai/custom-middleware.ts` must no longer be the only path through which personal memory is injected; context assembly must work for both string and object model representations.
- `ChatContextSnapshot` stores chat-scoped summaries separately from cross-chat `UserMemory`.
- `MemoryExtractionEvent` or the equivalent job record provides idempotency and an audit trail for automatic extraction.
- `ContextTrace` stores privacy-safe selection metadata and version identifiers for evaluation and debugging.
- `lib/jobs/` supplies database-backed claim and retry primitives shared by knowledge ingestion, summarization, and memory extraction.
- Existing routes may keep `after()` only as a best-effort wake-up signal after a durable job has already been committed.
- Evaluation fixtures must be synthetic or safely anonymized and must never include production personal data.

## 6. Step-by-Step Implementation Plan

### Execution protocol

- Implement one numbered step at a time unless two steps are explicitly safe to develop in parallel.
- Before starting a step, change the plan status to **In Progress** and mark that step's checklist item active in the implementation task or pull request.
- Do not mark a step complete until every **Done when** condition has direct evidence.
- Run the narrow tests for the step first, followed by the phase acceptance gate.
- Do not begin the next phase until every checkbox in the current phase gate passes.
- Record migrations, important design decisions, verification output, and any approved deviations in the implementation task or pull request.
- If implementation invalidates a repository fact or assumption, update this plan before continuing.
- Keep rollout flags until the observation window and rollback rehearsal are complete.

### Phase 0 — Baseline, contracts, and safety net

#### Step 0.1 — Record baseline behavior and budgets

- **What to do**:
  - Add a synthetic baseline fixture containing a long chat, relevant and irrelevant personal memories, and approved knowledge passages.
  - Record current prompt size, selected memories, knowledge searches per turn, latency, and expected answer evidence.
  - Add configuration entries for provisional context budgets without changing production behavior.
- **Why**: Later improvements require evidence that context size, relevance, and grounding improved without breaking existing behavior.
- **Affected files**:
  - `tests/fixtures/memory-context-evaluation/**`
  - `lib/context/budget.ts`
  - `lib/memory/config.ts`
  - `.env.example`
- **Dependencies**: None.
- **Done when**:
  - A deterministic fixture can reproduce current selection behavior.
  - Default budgets are documented and validated.
  - No runtime selection behavior has changed.

#### Step 0.2 — Define versioned contracts

- **What to do**:
  - Define TypeScript types for context sections, memory lifecycle states, extraction operations, summary snapshots, ranking results, and trace records.
  - Define constants for context policy, summary, extractor, chunker, embedding, and retrieval versions.
  - Add schemas that reject unknown lifecycle transitions and invalid extraction operations.
- **Why**: Versioned contracts let the system evolve safely and make stored outputs reproducible.
- **Affected files**:
  - `lib/context/trace.ts`
  - `lib/memory/types.ts`
  - `ai/memory/extraction-schema.ts`
  - `lib/knowledge/versions.ts`
  - `lib/jobs/types.ts`
- **Dependencies**: Step 0.1.
- **Done when**:
  - Contracts compile independently of UI code.
  - Unit tests cover every allowed and prohibited state transition.

#### Step 0.3 — Add rollout flags and shadow modes

- **What to do**:
  - Add flags for context assembly, conversation summaries, memory lifecycle, memory semantic retrieval, single knowledge retrieval, durable jobs, incremental indexing, and context traces.
  - Add `shadow` modes where new selectors run and log differences without affecting the model prompt.
  - Document defaults for development, test, and production.
- **Why**: The plan spans several data and ranking changes that need independent rollback.
- **Affected files**:
  - `lib/memory/config.ts`
  - `lib/knowledge/config.ts`
  - `lib/context/budget.ts`
  - `.env.example`
  - `scripts/validate-deployment-env.ts`
- **Dependencies**: Step 0.2.
- **Done when**:
  - Every new behavior can be enabled or disabled independently.
  - Invalid production combinations fail environment validation.

### Phase 1 — Bound and stabilize conversation context

#### Step 1.1 — Add conversation context snapshots

- **What to do**:
  - Add `updatedAt` to `Chat`.
  - Add `ChatContextSnapshot` with summary, covered message boundary, structured decisions, open tasks, entities, constraints, summary version, and timestamps.
  - Backfill existing chats with no snapshot; do not generate summaries during migration.
  - Add scoped read and upsert queries that verify chat ownership.
- **Why**: Older turns need a durable chat-scoped representation before message compaction can be enabled.
- **Affected files**:
  - `prisma/schema.prisma`
  - `prisma/migrations/<timestamp>_context_snapshots/migration.sql`
  - `db/chat-context-queries.ts`
  - `db/queries.ts`
- **Dependencies**: Phase 0.
- **Done when**:
  - Migrations apply to an existing database without rewriting `Chat.messages`.
  - A snapshot cannot be read or updated through another user's chat.
  - Existing chats load normally with a missing snapshot.

#### Step 1.2 — Implement deterministic message windowing

- **What to do**:
  - Identify meaningful text and tool messages.
  - Select the newest messages within both message-count and token budgets.
  - Preserve complete user/assistant/tool interaction groups.
  - Never cut a tool call away from its result.
  - Return the oldest excluded message boundary for summary generation.
- **Why**: A recent-message window must remain structurally valid for every provider.
- **Affected files**:
  - `lib/context/message-window.ts`
  - `lib/context/token-estimator.ts`
  - `tests/unit/context/message-window.test.ts`
- **Dependencies**: Step 1.1.
- **Done when**:
  - Tests cover long text, tool calls, incomplete tool calls, empty parts, and oversized individual messages.
  - Window output always remains below its configured budget or explicitly reports one unavoidable oversized message.

#### Step 1.3 — Add shared durable maintenance-job primitives

- **What to do**:
  - Add a generic `MaintenanceJob` model with type, payload, status, attempts, available time, lease owner, lease expiry, heartbeat, terminal error, and unique idempotency key.
  - Claim work using an atomic PostgreSQL transaction and `FOR UPDATE SKIP LOCKED`.
  - Add retry classification, exponential backoff with jitter, maximum attempts, and dead-letter status.
  - Add a worker command and protected internal trigger.
  - Keep `after()` only as a wake-up hint after the job is committed.
- **Why**: Summarization, extraction, ingestion, and maintenance need recoverable execution independent of request lifetime.
- **Affected files**:
  - `prisma/schema.prisma`
  - `prisma/migrations/<timestamp>_durable_maintenance_jobs/migration.sql`
  - `lib/jobs/claim.ts`
  - `lib/jobs/retry.ts`
  - `lib/jobs/types.ts`
  - `db/maintenance-job-queries.ts`
  - `scripts/run-maintenance-worker.ts`
  - `app/(chat)/api/internal/context-maintenance/route.ts`
  - `app/(chat)/api/internal/knowledge-worker/route.ts`
  - `tests/unit/jobs/claim.test.ts`
  - `tests/unit/jobs/retry.test.ts`
- **Dependencies**: Phase 0.
- **Done when**:
  - Two workers cannot claim the same job concurrently.
  - An expired lease is recoverable.
  - Permanent failures reach a terminal state with a safe error.
  - Internal endpoints require a dedicated secret and are not exposed to normal sessions.

#### Step 1.4 — Implement incremental conversation summarization

- **What to do**:
  - Add a structured summarization schema for narrative summary, decisions, open tasks, entities, and constraints.
  - Generate a new summary from the previous snapshot plus newly excluded messages.
  - Use an idempotency key based on chat ID, prior boundary, next boundary, and summary version.
  - Persist a durable maintenance job before attempting generation.
  - Treat user statements as user claims and never promote assistant speculation to fact.
- **Why**: Incremental summaries retain conversational continuity without repeatedly summarizing the full chat.
- **Affected files**:
  - `ai/memory/summarization.ts`
  - `db/chat-context-queries.ts`
  - `db/maintenance-job-queries.ts`
  - `tests/unit/ai/conversation-summary.test.ts`
  - `tests/integration/conversation-compaction.test.ts`
- **Dependencies**: Steps 1.1–1.3.
- **Done when**:
  - Repeating the same summarization request does not create a second snapshot.
  - Summary boundaries advance monotonically.
  - Test fixtures prove that decisions and open tasks survive compaction.

#### Step 1.5 — Build the central context assembler

- **What to do**:
  - Assemble system instructions, agent settings, chat summary, recent messages, personal memory candidates, company knowledge candidates, and tool context.
  - Apply hard per-section and overall budgets.
  - Give safety and response reserve budgets precedence over optional retrieved context.
  - Return selected context, omitted-context reasons, token estimates, and version metadata.
  - Keep prompt formatting isolated from retrieval and persistence.
- **Why**: Context selection must have one auditable policy instead of being distributed across middleware and prompts.
- **Affected files**:
  - `lib/context/assembler.ts`
  - `lib/context/budget.ts`
  - `lib/context/token-estimator.ts`
  - `lib/memory/preflight.ts`
  - `tests/unit/context/assembler.test.ts`
  - `tests/unit/context/budget.test.ts`
- **Dependencies**: Steps 1.1–1.4.
- **Done when**:
  - The same inputs and policy version produce the same selected context.
  - Every assembled prompt respects the overall budget in tests.
  - Excluded sections contain a machine-readable reason.

#### Step 1.6 — Integrate context assembly into chat

- **What to do**:
  - Call the assembler before `streamText`.
  - Replace direct whole-history conversion with the selected recent window plus summary.
  - Remove correctness dependence on model middleware so all provider representations receive the same context.
  - Initially run the assembler in shadow mode and compare it with existing prompts.
  - Enable it for a small rollout only after the Phase 1 gate passes.
- **Why**: This is the behavior switch that bounds prompt growth.
- **Affected files**:
  - `ai/chat/stream-chat.ts`
  - `ai/custom-middleware.ts`
  - `app/(chat)/api/chat/route.ts`
  - `tests/integration/context-assembly.test.ts`
  - `tests/e2e/long-conversation.spec.ts`
- **Dependencies**: Steps 1.1–1.5.
- **Done when**:
  - String and object model selections receive equivalent memory and summary context.
  - A long-chat E2E test stays within the target budget and retains required decisions.
  - Disabling the flag restores the previous orchestration path.

#### Phase 1 acceptance gate

- [ ] Prompt growth is bounded for the long-chat fixture.
- [ ] Summary information survives after original messages leave the prompt window.
- [ ] Tool-call/result groups remain valid.
- [ ] Durable jobs are recoverable and duplicate-safe.
- [ ] Context assembly works for every configured provider adapter.
- [ ] No cross-chat summary leakage is possible.
- [ ] Shadow comparisons show no critical loss on the evaluation fixture.

### Phase 2 — Make personal memory trustworthy

#### Step 2.1 — Add personal-memory lifecycle and provenance schema

- **What to do**:
  - Add enums for memory status and sensitivity.
  - Add canonical key, confidence, provenance, validity, confirmation, pinning, usage, supersession, and extractor-version fields.
  - Add an optional 768-dimensional embedding and full-text search vector.
  - Add `MemoryExtractionEvent` with a unique idempotency key, source boundary, extractor version, status, and error.
  - Backfill existing memories as active; mark manual memories as confirmed and leave unknown provenance nullable.
  - Add partial indexes and constraints for active lookup, validity, and idempotency.
- **Why**: Reliable correction, retrieval, and replay require durable lifecycle and provenance.
- **Affected files**:
  - `prisma/schema.prisma`
  - `prisma/migrations/<timestamp>_personal_memory_lifecycle/migration.sql`
  - `lib/memory/types.ts`
- **Dependencies**: Phase 1 acceptance gate.
- **Done when**:
  - Existing memories remain visible after migration.
  - Invalid confidence, lifecycle, and validity values are rejected by database constraints.
  - Extraction events are uniquely keyed.

#### Step 2.2 — Implement canonicalization and lifecycle transitions

- **What to do**:
  - Normalize canonical keys without deriving them from display titles alone.
  - Implement allowed transitions: active to superseded, disputed, expired, or deleted; disputed to active or superseded; no automatic return from deleted.
  - Implement transactional correction that creates the replacement and supersedes the old memory atomically.
  - Preserve manual-source authority.
  - Add retries for safe serializable transaction conflicts.
- **Why**: Memory correctness depends on explicit and atomic change semantics.
- **Affected files**:
  - `lib/memory/canonicalization.ts`
  - `lib/memory/lifecycle.ts`
  - `db/memory-queries.ts`
  - `tests/unit/memory/canonicalization.test.ts`
  - `tests/unit/memory/lifecycle.test.ts`
  - `tests/integration/memory-lifecycle.test.ts`
- **Dependencies**: Step 2.1.
- **Done when**:
  - Correction tests prove only the replacement is retrievable.
  - Manual memories cannot be silently overwritten by automatic extraction.
  - Concurrent duplicate writes resolve to one active canonical memory.

#### Step 2.3 — Make automatic extraction idempotent and operation-based

- **What to do**:
  - Change extraction output to `CREATE`, `REFINE`, `SUPERSEDE`, `IGNORE`, or `REQUEST_CONFIRMATION`.
  - Include canonical key, confidence, sensitivity, validity hints, and source message ID.
  - Persist the extraction event before applying memory changes.
  - Reject secrets and prohibited sensitivity classes through deterministic validation in addition to model instructions.
  - Record extractor version and terminal status.
  - Move extraction scheduling to a durable job; `onFinish` should save the chat and enqueue work, not perform the full extraction inline.
- **Why**: Model output alone is not sufficient protection against retries, duplicates, conflicts, or sensitive data.
- **Affected files**:
  - `ai/memory/extraction.ts`
  - `ai/memory/extraction-schema.ts`
  - `app/(chat)/api/chat/route.ts`
  - `db/memory-queries.ts`
  - `db/maintenance-job-queries.ts`
  - `lib/memory/privacy.ts`
  - `tests/unit/ai/memory-extraction.test.ts`
- **Dependencies**: Steps 2.1–2.2 and Step 1.3.
- **Done when**:
  - Replaying the same completed message cannot create or modify memory twice.
  - Prohibited test strings never reach `UserMemory`.
  - Every automatic memory links to an extraction event and source message.

#### Step 2.4 — Implement hybrid personal-memory retrieval

- **What to do**:
  - Embed active eligible memories.
  - Build full-text search vectors.
  - Retrieve pinned global preferences separately from query-relevant memories.
  - Fuse semantic and keyword ranks, then apply priority, confidence, confirmation, validity, and staleness adjustments.
  - Exclude superseded, disputed, expired, and deleted memories by default.
  - Return stable IDs and selection reasons to the context assembler.
  - Run the new selector in shadow mode against the existing top-15 preflight.
- **Why**: Context quality degrades if every turn receives the same high-priority memories.
- **Affected files**:
  - `lib/memory/retrieval.ts`
  - `lib/memory/scoring.ts`
  - `lib/memory/preflight.ts`
  - `lib/knowledge/embeddings.ts`
  - `db/memory-queries.ts`
  - `tests/unit/memory/retrieval.test.ts`
- **Dependencies**: Steps 2.1–2.3.
- **Done when**:
  - Evaluation fixtures retrieve expected relevant memories and exclude known distractors.
  - Retrieval remains within the personal-memory context budget.
  - No ineligible status appears in default results.

#### Step 2.5 — Remove correctness dependence on process-local cache

- **What to do**:
  - Disable the process-local `Map` for authoritative retrieval.
  - Prefer direct bounded database retrieval initially.
  - If profiling later justifies shared caching, introduce revisioned shared keys as a separate optimization.
  - Retain a test-only cache reset only where tests require it.
- **Why**: Multi-instance cache invalidation cannot be guaranteed by a local map.
- **Affected files**:
  - `lib/memory/cache.ts`
  - `lib/memory/preflight.ts`
  - `db/memory-queries.ts`
  - `tests/unit/memory/cache.test.ts`
- **Dependencies**: Step 2.4.
- **Done when**:
  - A memory correction is immediately visible to the next read without process affinity.
  - Runtime correctness no longer depends on local invalidation.

#### Step 2.6 — Add user memory inspection and correction controls

- **What to do**:
  - Add detail views showing status, source type, confirmation, validity, and safe provenance.
  - Add actions for pin, unpin, correct, dispute, confirm, and forget.
  - Add “why this was used” information when a context trace exists.
  - Keep physical deletion separate from ordinary forget semantics if retention policy requires tombstones.
  - Update AI tools to use lifecycle transitions rather than physical deletion for corrections.
- **Why**: Sustainable memory requires user-visible control and explainability.
- **Affected files**:
  - `app/(chat)/api/user-memory/route.ts`
  - `app/(chat)/api/user-memory/[id]/route.ts`
  - `app/(chat)/settings/agent/page.tsx`
  - `components/settings/agent-settings.tsx`
  - `components/settings/memory-detail.tsx`
  - `components/settings/memory-source-badge.tsx`
  - `components/settings/memory-status-actions.tsx`
  - `ai/tools/user-memory.ts`
  - `tests/e2e/memory-controls.spec.ts`
- **Dependencies**: Steps 2.1–2.5.
- **Done when**:
  - Users can inspect and correct every memory they own.
  - Users cannot access or mutate another user's memory.
  - A corrected memory affects the next response without waiting for cache expiry.

#### Phase 2 acceptance gate

- [ ] Automatic extraction is idempotent.
- [ ] Manual memories remain authoritative.
- [ ] Corrections atomically supersede old information.
- [ ] Ineligible and expired memories never reach ordinary context.
- [ ] Relevant-memory precision meets the initial evaluation threshold.
- [ ] Users can inspect, pin, correct, dispute, confirm, and forget memories.
- [ ] Sensitive-data fixtures are rejected before persistence.

### Phase 3 — Durable jobs and scalable knowledge indexing

#### Step 3.1 — Move knowledge ingestion to durable execution

- **What to do**:
  - Commit the source, version, ingestion job, and maintenance wake-up atomically.
  - Remove direct dependence on request-bound processing.
  - Add heartbeats between extraction, chunking, embedding batches, and publishing.
  - Resume or safely restart interrupted versions.
  - Keep the current approved version searchable until replacement approval.
- **Why**: Application restarts must not strand queued or processing knowledge versions.
- **Affected files**:
  - `app/(chat)/api/knowledge/route.ts`
  - `app/(chat)/api/knowledge/[id]/rescan/route.ts`
  - `db/knowledge-queries.ts`
  - `lib/knowledge/ingestion.ts`
  - `lib/knowledge/worker.ts`
  - `tests/integration/knowledge-worker.test.ts`
- **Dependencies**: Step 1.3 and the Phase 2 acceptance gate.
- **Done when**:
  - A test terminates processing mid-job and proves a second worker completes it.
  - Duplicate worker delivery does not duplicate chunks or publish twice.

#### Step 3.2 — Batch embedding and chunk persistence

- **What to do**:
  - Add a bounded embedding batch API.
  - Retry transient provider errors at batch granularity.
  - Bulk-create chunk rows and update vectors with bounded transactions.
  - Record provider latency, batch size, and failures without storing source content in logs.
- **Why**: Sequential embedding and per-chunk writes do not scale sustainably.
- **Affected files**:
  - `lib/knowledge/embeddings.ts`
  - `lib/knowledge/ingestion.ts`
  - `lib/knowledge/worker.ts`
  - `tests/integration/knowledge-worker.test.ts`
- **Dependencies**: Step 3.1.
- **Done when**:
  - Large-fixture ingestion uses bounded batches.
  - A failed batch can retry without duplicating successful chunks.
  - Ingestion latency improves against the Phase 0 baseline.

#### Step 3.3 — Add content-addressed chunks and configuration versions

- **What to do**:
  - Add normalized content hash, extractor version, chunker version, embedding provider, embedding model, dimensions, and embedding configuration version.
  - Match new-version chunks to previous chunks by compatible configuration and content hash.
  - Reuse embeddings only when all embedding compatibility fields match.
  - Re-embed all affected chunks when compatibility changes.
- **Why**: Unchanged content should not incur repeated embedding cost, and model changes need a safe migration contract.
- **Affected files**:
  - `prisma/schema.prisma`
  - `prisma/migrations/<timestamp>_content_addressed_chunks/migration.sql`
  - `lib/knowledge/chunking.ts`
  - `lib/knowledge/ingestion.ts`
  - `lib/knowledge/versions.ts`
  - `tests/unit/knowledge/incremental-indexing.test.ts`
- **Dependencies**: Steps 3.1–3.2.
- **Done when**:
  - An unchanged rescan creates no new embedding requests.
  - A one-section edit embeds only changed compatible chunks.
  - A version mismatch forces safe re-embedding.

#### Phase 3 acceptance gate

- [ ] Queued jobs survive application restarts.
- [ ] Lease expiry and retries are verified.
- [ ] Duplicate delivery is safe.
- [ ] Embeddings are batched with bounded concurrency.
- [ ] Unchanged chunks reuse compatible embeddings.
- [ ] Approved knowledge remains available during failed replacements.

### Phase 4 — Improve company retrieval and grounding

#### Step 4.1 — Eliminate duplicate initial knowledge retrieval

- **What to do**:
  - Decide applicability before initial retrieval using deterministic rules plus a bounded classifier only if needed.
  - Represent the initial retrieval as orchestration evidence available to the model.
  - Do not require the model to repeat the same search.
  - Permit additional searches only for a meaningfully changed query.
  - Group all searches under a response trace.
- **Why**: Duplicate retrieval wastes latency, embeddings, log volume, and rate-limit capacity.
- **Affected files**:
  - `ai/chat/stream-chat.ts`
  - `ai/prompts/company-assistant.ts`
  - `ai/knowledge-tools.ts`
  - `lib/context/assembler.ts`
  - `lib/knowledge/retrieval.ts`
- **Dependencies**: Phase 1 and Step 3.2.
- **Done when**:
  - A normal company question produces one initial search.
  - A deliberate reformulation can produce a second trace-linked search.
  - No-knowledge questions do not embed a company query.

#### Step 4.2 — Implement stable rank fusion and diversity

- **What to do**:
  - Retrieve larger semantic and keyword candidate sets separately.
  - Fuse ranks with a stable method such as reciprocal-rank fusion.
  - Apply source metadata filters and validity rules.
  - Select diverse passages across source, section, and content similarity.
  - Return component ranks and selection reasons for traces.
- **Why**: Directly adding differently scaled raw scores is difficult to calibrate and can return redundant passages.
- **Affected files**:
  - `lib/knowledge/retrieval.ts`
  - `lib/knowledge/ranking.ts`
  - `lib/knowledge/types.ts`
  - `tests/unit/knowledge/ranking.test.ts`
- **Dependencies**: Step 4.1.
- **Done when**:
  - Ranking tests are deterministic.
  - Evaluation recall and result diversity meet documented thresholds.
  - Current-version, approval, audience, and validity filters are enforced before ranking.

#### Step 4.3 — Add confidence states and optional reranking

- **What to do**:
  - Calibrate `SUPPORTED`, `LOW_CONFIDENCE`, `CONFLICTING`, `STALE`, `NOT_FOUND`, and `UNAVAILABLE` states.
  - Add an optional lightweight reranker behind a feature flag.
  - Require response behavior appropriate to each state.
  - Separate source-backed claims from general guidance.
- **Why**: A single numeric threshold cannot distinguish absence, conflict, staleness, and operational failure.
- **Affected files**:
  - `lib/knowledge/ranking.ts`
  - `lib/knowledge/retrieval.ts`
  - `ai/prompts/company-assistant.ts`
  - `ai/knowledge-tools.ts`
  - `tests/e2e/grounded-company-answer.spec.ts`
- **Dependencies**: Step 4.2.
- **Done when**:
  - Fixtures exercise every state.
  - Unsupported company answers abstain.
  - Conflicting sources are surfaced with both citations.

#### Phase 4 acceptance gate

- [ ] One initial retrieval is the normal path.
- [ ] Rank fusion and diversity improve or preserve Recall@k.
- [ ] Each evidence state has tested response behavior.
- [ ] Citation correctness and unsupported-claim thresholds pass.
- [ ] Retrieval can be rolled back independently from ingestion.

### Phase 5 — Governance, privacy, and user trust

#### Step 5.1 — Add workspace-ready knowledge governance

- **What to do**:
  - Add workspace ID, owner, audience, classification, authority, effective date, expiry date, review date, and superseded source.
  - Backfill existing sources into a default workspace.
  - Apply workspace and audience filters in every management and retrieval query.
  - Keep a feature flag for the single-workspace UI until membership management is required.
- **Why**: Scope and authority are difficult to retrofit safely after the corpus grows.
- **Affected files**:
  - `prisma/schema.prisma`
  - `prisma/migrations/<timestamp>_knowledge_governance/migration.sql`
  - `db/knowledge-queries.ts`
  - `lib/knowledge/retrieval.ts`
  - `lib/auth/permissions.ts`
  - `app/(admin)/knowledge/page.tsx`
  - `app/(admin)/knowledge/[id]/page.tsx`
- **Dependencies**: Phase 4.
- **Done when**:
  - Existing sources belong to the default workspace.
  - Cross-workspace retrieval is impossible in integration tests.
  - Expired or unauthorized sources are excluded.

#### Step 5.2 — Add scheduled knowledge and memory maintenance

- **What to do**:
  - Schedule expiration, review reminders, broken-link checks, abandoned-job recovery, and orphaned-storage cleanup.
  - Expire eligible personal memories based on explicit validity rules; do not infer expiry from inactivity alone.
  - Record maintenance audit events and dry-run destructive cleanup first.
- **Why**: Sustainable data requires routine maintenance rather than manual crisis cleanup.
- **Affected files**:
  - `lib/knowledge/maintenance.ts`
  - `lib/memory/lifecycle.ts`
  - `db/maintenance-job-queries.ts`
  - `scripts/run-maintenance-worker.ts`
  - `docs/memory-and-context-operations.md`
- **Dependencies**: Steps 1.3, 5.1, and approved retention decisions.
- **Done when**:
  - Dry-run output identifies exact targets.
  - Cleanup is idempotent and audit logged.
  - Expired data stops influencing retrieval before physical deletion.

#### Step 5.3 — Implement privacy export and deletion

- **What to do**:
  - Add authenticated export of personal memories and safe provenance.
  - Add deletion workflows covering memories, summaries, traces, embeddings, caches, and stored files according to retention policy.
  - Separate immediate retrieval exclusion from asynchronous physical cleanup.
  - Document retention and deletion guarantees.
- **Why**: User control is incomplete unless all derived context can be exported or removed.
- **Affected files**:
  - `app/(chat)/api/user-memory/export/route.ts`
  - `app/(chat)/api/user-memory/route.ts`
  - `lib/memory/privacy.ts`
  - `db/memory-queries.ts`
  - `db/context-trace-queries.ts`
  - `tests/integration/privacy-deletion.test.ts`
  - `docs/memory-privacy-and-retention.md`
- **Dependencies**: Phases 1–2 and retention decisions.
- **Done when**:
  - Export contains all user-owned memory categories and lifecycle data allowed by policy.
  - Deletion tests prove excluded data cannot be retrieved immediately.
  - Asynchronous cleanup leaves no orphaned embeddings or cache entries.

#### Phase 5 acceptance gate

- [ ] Workspace and audience isolation are enforced server-side.
- [ ] Ownership, authority, effective, expiry, and review fields are operational.
- [ ] Maintenance jobs are recoverable and auditable.
- [ ] Users can export and delete derived personal context.
- [ ] Retention behavior is documented and tested.

### Phase 6 — Evaluation, traces, and rollout

#### Step 6.1 — Add privacy-safe context traces

- **What to do**:
  - Add `ContextTrace` and selected-item records or bounded JSON metadata.
  - Record IDs, ranks, token estimates, policy versions, timings, evidence state, and citation coverage.
  - Do not store full prompts or memory contents.
  - Add retention cleanup and role-limited diagnostics.
- **Why**: The team needs to explain context selection and diagnose regressions without building a sensitive prompt archive.
- **Affected files**:
  - `prisma/schema.prisma`
  - `prisma/migrations/<timestamp>_context_traces/migration.sql`
  - `lib/context/trace.ts`
  - `db/context-trace-queries.ts`
  - `ai/chat/stream-chat.ts`
- **Dependencies**: Phases 1, 2, and 4.
- **Done when**:
  - A response trace identifies every selected context item and policy version.
  - No raw personal-memory content is stored in trace fields.
  - Trace cleanup follows the configured retention period.

#### Step 6.2 — Build the automated evaluation runner

- **What to do**:
  - Create versioned synthetic fixtures for memory writes, corrections, retrieval, compaction, knowledge ranking, conflicts, abstention, citations, and prompt injection.
  - Calculate Recall@k, ranking quality, memory precision, correction success, abstention accuracy, citation correctness, unsupported-claim rate, latency, tokens, and estimated cost.
  - Emit machine-readable JSON and a concise human report.
  - Fail CI when hard safety or grounding thresholds regress.
- **Why**: Type checks and endpoint tests cannot prove retrieval or grounding quality.
- **Affected files**:
  - `tests/fixtures/memory-context-evaluation/**`
  - `scripts/evaluate-memory-context.ts`
  - `package.json`
  - `vitest.config.ts`
  - `README.md`
- **Dependencies**: All behavior phases.
- **Done when**:
  - The runner is deterministic for fixed local fixtures.
  - Hard safety cases have zero tolerance.
  - Quality thresholds and allowed variance are documented.

#### Step 6.3 — Complete staged rollout and operational handoff

- **What to do**:
  - Run migrations with new behavior disabled.
  - Backfill lifecycle fields, search vectors, embeddings, summaries where appropriate, workspace scope, and chunk hashes in resumable batches.
  - Enable traces and shadow selectors.
  - Compare old and new selection on representative traffic without storing raw prompts.
  - Enable phases progressively for internal users, then broader cohorts.
  - Define alerts, dashboards, owner rotation, incident procedures, and rollback commands.
  - Remove obsolete paths only after the rollback window closes.
- **Why**: Context changes can alter answer behavior even when infrastructure remains healthy.
- **Affected files**:
  - `scripts/verify-context-assembly.ts`
  - `scripts/evaluate-memory-context.ts`
  - `docs/memory-and-context-operations.md`
  - `docs/knowledge-administration.md`
  - `.env.example`
  - `README.md`
- **Dependencies**: Steps 6.1–6.2 and every earlier phase gate.
- **Done when**:
  - Every rollout flag has an owner, default, enable condition, and rollback condition.
  - Production verification passes.
  - Operational owners can recover a stuck job and disable any new selector without a deploy.

#### Phase 6 acceptance gate

- [ ] All automated evaluation thresholds pass.
- [ ] Safety fixtures have no violations.
- [ ] Backfills are complete and resumable.
- [ ] Operational dashboards and alerts are active.
- [ ] Rollback procedures have been rehearsed.
- [ ] Obsolete paths are removed only after the observation window.

## 7. Database Changes

### New or extended models

#### `Chat`

- Add `updatedAt`.
- Retain `messages` as the complete durable history.

#### `ChatContextSnapshot`

- `id`
- `chatId`
- `summary`
- `summaryThroughMessageId`
- `decisions` JSON
- `openTasks` JSON
- `importantEntities` JSON
- `activeConstraints` JSON
- `summaryVersion`
- `createdAt`
- `updatedAt`
- Unique index on `chatId`

#### `UserMemory`

- Add `status`, `canonicalKey`, `confidence`, `sensitivity`, `sourceChatId`, `sourceMessageId`, optional safe `sourceExcerpt`, `supersedesId`, `validFrom`, `validUntil`, `lastConfirmedAt`, `lastUsedAt`, `useCount`, `pinned`, `extractionVersion`, `embedding`, and `searchVector`.
- Add indexes for active user lookup, canonical key, validity, pinning, and vector search.
- Use database constraints for confidence, validity ranges, use count, and allowed lifecycle values.
- If PostgreSQL cannot express the desired active-only uniqueness cleanly through Prisma, add an explicit partial unique index in SQL.

#### `MemoryExtractionEvent`

- `id`
- `userId`
- `chatId`
- `sourceMessageId`
- `idempotencyKey`
- `extractorVersion`
- `status`
- `resultMetadata`
- `errorMessage`
- `createdAt`
- `completedAt`
- Unique index on `idempotencyKey`

#### `MaintenanceJob`

- `id`
- `type`
- `payload`
- `status`
- `attempts`
- `maxAttempts`
- `availableAt`
- `leaseOwner`
- `leaseExpiresAt`
- `heartbeatAt`
- `idempotencyKey`
- `errorMessage`
- `createdAt`
- `startedAt`
- `completedAt`
- Unique index on `idempotencyKey`
- Claim index on `status`, `availableAt`, and `leaseExpiresAt`

#### `KnowledgeChunk`

- Add `contentHash`, `chunkerVersion`, `embeddingProvider`, `embeddingModel`, `embeddingDimensions`, and `embeddingConfigVersion`.
- Index compatible content hashes for reuse.

#### `KnowledgeSource` and `KnowledgeSourceVersion`

- Add workspace, owner, audience, classification, authority, effective, expiry, review, and supersession metadata.
- Store extractor and retrieval schema versions on the immutable version.

#### `ContextTrace`

- `id`
- `chatId`
- `userId`
- `contextPolicyVersion`
- `summaryVersion`
- `retrievalVersion`
- `selectedItemMetadata` JSON without raw content
- `sectionTokenCounts` JSON
- `evidenceState`
- `latencyMetadata` JSON
- `citationCoverage`
- `createdAt`
- Retention index on `createdAt`

### Migration strategy

1. Create additive nullable fields and new tables.
2. Deploy with all new behavior disabled.
3. Backfill status and provenance defaults in bounded batches.
4. Backfill search vectors and embeddings separately from schema migration.
5. Add partial indexes and non-null constraints only after backfill verification.
6. Enable shadow reads.
7. Enable authoritative reads by cohort.
8. Retain old columns and code paths through the rollback window.
9. Remove obsolete paths in a later cleanup migration.

### Seed and backfill requirements

- Create one default workspace if workspace scope is enabled.
- Assign all existing users and knowledge sources to the default workspace according to the chosen membership model.
- Mark existing memories `ACTIVE`.
- Treat existing `manual` memories as confirmed.
- Leave unknown chat/message provenance null.
- Calculate canonical keys conservatively; ambiguous existing memories remain without a canonical key until reviewed.
- Backfill memory embeddings and full-text vectors asynchronously.
- Backfill knowledge chunk hashes without changing approved-version pointers.
- Do not generate summaries for every historical chat during migration; summarize on next use or in a throttled background backfill.

## 8. Backend Changes

### Context assembly

- Introduce a pure context-selection layer that accepts already authorized inputs.
- Keep retrieval, formatting, budgeting, and persistence separately testable.
- Make selection deterministic for the same policy version and inputs.

### Summarization

- Use structured output and an incremental summary boundary.
- Enqueue durable work when a threshold is crossed.
- Permit synchronous generation only in tests or controlled shadow mode.

### Personal-memory writes

- Route manual writes and automatic extraction through shared lifecycle services.
- Require source authority checks before refine or supersede.
- Keep physical deletion separate from logical forget where policy requires audit retention.

### Personal-memory retrieval

- Perform pinned and relevant retrieval independently.
- Apply user ownership and eligibility filters before ranking.
- Return only bounded safe fields to the model.

### Knowledge retrieval

- Consolidate the initial search.
- Add rank fusion, diversity, validity, audience, and workspace filtering.
- Return explicit evidence states.

### Durable workers

- Use PostgreSQL row claiming with leases.
- Protect internal worker triggers with a dedicated secret.
- Make every handler idempotent.
- Emit safe structured logs and heartbeats.

### Maintenance

- Support review reminders, expiry, broken links, abandoned jobs, and orphan cleanup.
- Require dry-run and exact-target resolution before destructive cleanup.

## 9. Frontend Changes

### Agent settings and memory management

- Show active, disputed, superseded, expired, and pinned states.
- Display whether a memory was manual or automatic.
- Display safe provenance and last confirmation.
- Provide pin, unpin, correct, dispute, confirm, and forget actions.
- Clearly explain that conversation summaries stay inside one chat.

### Answer explainability

- Reuse existing memory/knowledge consultation UI where possible.
- Show which user memories and company sources influenced the response.
- Avoid exposing internal scores unless an administrator diagnostic mode is enabled.
- Distinguish company evidence from personal preference adaptation.

### Knowledge administration

- Add owner, audience, authority, effective, expiry, and review fields.
- Show stale and expired warnings.
- Add review queues and filters.
- Preserve explicit approval for authoritative versions.

## 10. Validation Rules

### Context

- Reject negative or inconsistent token budgets.
- Always reserve system safety and response capacity.
- Never split a tool call from its result.
- Reject a snapshot boundary that moves backward.
- Cap summary size and structured collection sizes.

### Personal memory

- Title: 1–200 trimmed characters.
- Content: 1–4,000 trimmed characters unless product requirements change.
- Canonical keys: lowercase controlled format with bounded length.
- Confidence: 0–1.
- Priority: 0–10.
- Use count: non-negative.
- `validUntil` must be after `validFrom`.
- A memory cannot supersede itself.
- Supersession must stay within the same user.
- Deleted memories cannot become active automatically.
- Automatic extraction cannot store prohibited sensitivity classes.
- Manual data cannot be overwritten by automatic extraction without an explicit user-confirmed operation.

### Knowledge

- Workspace, audience, and validity filters apply before retrieval.
- Expired sources cannot become newly approved without updated validity.
- Reused embeddings require exact configuration compatibility.
- Job heartbeats and lease expirations must be bounded.
- Retry payloads must be size-limited and schema-validated.

### Traces and logs

- Do not store raw prompts, credentials, or full memory content.
- Cap JSON metadata sizes.
- Apply retention cleanup.

## 11. Security Considerations

- Enforce user ownership in every personal-memory and chat-summary query.
- Enforce workspace and audience scope in every company-knowledge query.
- Treat summaries, memories, documents, and retrieved passages as untrusted reference data.
- Keep system instructions outside data-delimited context blocks.
- Prevent prompt content from changing lifecycle state without validated tools or server functions.
- Apply deterministic sensitive-data checks before automatic memory persistence.
- Do not log raw source content, prompts, API keys, or embeddings.
- Authenticate internal worker endpoints with a dedicated rotating secret.
- Ensure job payloads contain identifiers rather than unnecessary sensitive content.
- Apply rate limits to memory mutations, extraction scheduling, exports, and expensive retrieval.
- Audit user-visible corrections, administrative knowledge changes, maintenance deletion, and export requests.
- Make deletion immediately exclude data from retrieval even when physical cleanup is asynchronous.
- Test indirect prompt injection inside personal memories, summaries, company documents, and crawled pages.

## 12. Testing Plan

### Unit tests

- Context budget allocation and truncation
- Tool-call grouping in message windows
- Incremental summary boundary selection
- Summary schema validation
- Canonical-key normalization
- Memory lifecycle transitions
- Supersession authority
- Idempotency-key generation
- Sensitive-memory rejection
- Memory scoring and eligibility
- Knowledge rank fusion and diversity
- Chunk hashing and embedding compatibility
- Job claiming, lease expiry, and retry calculation

### Integration tests

- Existing chat migration and snapshot creation
- Long-chat compaction with preserved decisions
- Concurrent automatic extraction replay
- Manual-versus-automatic memory conflicts
- Immediate correction visibility
- Cross-user memory isolation
- Worker crash and lease recovery
- Duplicate knowledge job delivery
- Incremental reindexing
- Workspace and audience isolation
- Privacy export and deletion propagation
- Context trace privacy

### E2E tests

- User creates, pins, corrects, and forgets a memory.
- A long conversation preserves earlier constraints after compaction.
- A relevant memory affects an answer while a distractor does not.
- A company answer uses one initial retrieval and cites supporting evidence.
- A no-evidence company question abstains.
- A conflicting-source question surfaces the conflict.
- An expired source is not used.

### Evaluation tests

- Recall@k and ranking quality
- Memory precision and write precision
- Correction success
- Abstention accuracy
- Citation correctness
- Unsupported-claim rate
- Prompt-injection resistance
- Context token usage
- Retrieval latency and estimated cost

### Manual QA checklist

- [ ] Inspect a context trace and confirm it contains no raw personal content.
- [ ] Confirm the same memory is visible immediately after correction on another app instance.
- [ ] Confirm a chat summary does not affect another chat.
- [ ] Confirm a manual memory is not silently replaced by extraction.
- [ ] Stop a worker mid-job and verify recovery.
- [ ] Rescan an unchanged document and verify no embedding calls.
- [ ] Disable each rollout flag and confirm its fallback path.
- [ ] Export and delete a test user's memory data.

### Required verification commands

```bash
pnpm db:generate
pnpm typecheck
pnpm test
pnpm lint
pnpm verify:knowledge
pnpm evaluate:memory-context
pnpm build
```

Database-backed integration and E2E suites must also run against a disposable PostgreSQL database with pgvector enabled.

## 13. Rollback Plan

### Application rollback

- Keep new selectors, summaries, semantic memory retrieval, single-search orchestration, and durable workers behind independent flags.
- Disable authoritative new reads before rolling back application code.
- Continue dual-compatible writes only while both versions understand the schema.
- Preserve the legacy top-memory and knowledge search paths through the observation window.

### Database rollback

- Prefer forward-fix migrations for additive schema changes.
- Do not drop legacy fields in the same release that enables new reads.
- Before any destructive cleanup migration:
  - Verify backfill counts.
  - Export affected identifiers.
  - Back up the database.
  - Complete the rollback observation window.
- If an additive migration causes issues, disable the associated feature and leave unused columns in place until a reviewed cleanup migration.

### Data rollback

- Conversation summaries are derived and may be regenerated from retained chat history.
- Memory supersession preserves the prior record, allowing an administrative correction without reconstructing deleted data.
- Approved knowledge pointers must remain atomic; rollback selects the prior approved immutable version.
- Content-addressed reuse must never mutate embeddings on an already approved immutable version.

### Worker rollback

- Stop worker triggers.
- Allow active leases to expire.
- Disable new enqueueing by job type.
- Keep queued records for later replay.
- Never delete queued or failed jobs as the first recovery action.

## 14. Final Checklist

### Planning and contracts

- [x] Architectural recommendation documented
- [x] Codebase analyzed
- [x] Dependency-ordered implementation plan created
- [ ] Open product and operational decisions resolved
- [ ] Initial budgets and quality thresholds approved
- [ ] Rollout owners assigned

### Phase 0

- [ ] Baseline fixture and metrics recorded
- [ ] Versioned contracts implemented
- [ ] Feature flags and shadow modes implemented

### Phase 1

- [ ] Chat context snapshot migration applied
- [ ] Message windowing implemented
- [ ] Durable maintenance-job primitives implemented
- [ ] Incremental summarization implemented
- [ ] Central context assembler implemented
- [ ] Chat integration enabled after shadow validation
- [ ] Phase 1 acceptance gate passed

### Phase 2

- [ ] Personal-memory lifecycle migration applied
- [ ] Canonicalization and transitions implemented
- [ ] Idempotent extraction implemented
- [ ] Hybrid personal-memory retrieval implemented
- [ ] Process-local cache removed from correctness path
- [ ] User memory controls implemented
- [ ] Phase 2 acceptance gate passed

### Phase 3

- [ ] Knowledge ingestion moved to worker
- [ ] Batch embedding implemented
- [ ] Content-addressed chunks implemented
- [ ] Phase 3 acceptance gate passed

### Phase 4

- [ ] Duplicate initial retrieval removed
- [ ] Rank fusion and diversity implemented
- [ ] Evidence states and optional reranking implemented
- [ ] Phase 4 acceptance gate passed

### Phase 5

- [ ] Workspace-ready governance applied
- [ ] Scheduled maintenance implemented
- [ ] Privacy export and deletion implemented
- [ ] Phase 5 acceptance gate passed

### Phase 6

- [ ] Privacy-safe traces implemented
- [ ] Evaluation runner implemented
- [ ] Backfills completed
- [ ] Staged rollout completed
- [ ] Operational handoff completed
- [ ] Phase 6 acceptance gate passed

### Final verification

- [ ] Database migrations verified on a production-like copy
- [ ] Type checking passes
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] E2E tests pass
- [ ] Evaluation thresholds pass
- [ ] Lint passes
- [ ] Production build passes
- [ ] Security review passes
- [ ] Retention and deletion review passes
- [ ] Rollback rehearsal passes
- [ ] Documentation is current
- [ ] Plan status changed to Implemented with completion date
