# Sustainable Memory, Context, and Knowledge Recommendations

> **Document role:** Architectural recommendations and design rationale.
>
> **Canonical implementation roadmap:** [`plans/sustainable-memory-context/PLAN.md`](../plans/sustainable-memory-context/PLAN.md)
>
> Use the roadmap to execute this work. It contains dependency-ordered tasks, exact affected files, database migrations, acceptance gates, verification commands, and rollback procedures. Update its checklists as implementation progresses.

## 1. Purpose

This document recommends how to evolve the system's memory, conversation context, and company knowledge capabilities so they remain accurate, affordable, understandable, and maintainable as usage and stored data grow.

The system already has a useful foundation:

- Durable personal memories scoped to authenticated users
- Manual and automatic memory capture
- Approved and versioned company knowledge
- Hybrid vector and full-text knowledge retrieval
- Knowledge citations and surrounding-passage expansion
- User controls for viewing and deleting personal memories
- Knowledge ingestion jobs, audit events, and query logs

The primary sustainability gap is lifecycle management. The system needs stronger rules for selecting, summarizing, correcting, aging, evaluating, and operating stored context.

## 2. Guiding Principles

1. **Do not treat all memory as one collection.** Different information has different trust, retention, retrieval, and update requirements.
2. **Retrieve context instead of injecting everything.** Prompt size should be bounded and predictable.
3. **Preserve provenance.** The system should know where a memory came from and why it is considered valid.
4. **Prefer correction over silent replacement.** Superseded information should stop influencing answers without destroying useful history.
5. **Make background work durable and idempotent.** Retries must not create duplicate memories, chunks, or jobs.
6. **Measure answer quality, not only infrastructure health.** Successful requests do not necessarily mean grounded or relevant answers.
7. **Give users control.** Users should be able to inspect, correct, pin, and forget information.
8. **Treat all retrieved content as untrusted data.** Memories and documents must never become a route for prompt injection.

## 3. Target Context Architecture

The system should separate context into four layers.

### 3.1 Working Context

Working context contains information needed for the current response:

- The latest user request
- A limited number of recent turns
- Current tool calls and results
- Temporary instructions relevant only to the active task

Working context is short-lived and should not automatically become durable memory.

### 3.2 Conversation Memory

Conversation memory preserves the state of a longer chat after older messages leave the prompt:

- Rolling conversation summary
- Decisions already made
- Open questions
- Unresolved tasks
- Important entities and terminology
- Constraints the user established for the conversation

Conversation memory belongs to one chat and should not automatically affect unrelated chats.

### 3.3 Personal Memory

Personal memory contains durable information that may help across conversations:

- Stable user facts
- Explicit preferences
- Recurring working context
- User-pinned notes

Personal memory is private to the owning user. It requires provenance, lifecycle state, correction support, and explicit user controls.

### 3.4 Company Knowledge

Company knowledge contains approved organizational truth:

- Policies
- Processes
- Responsibilities
- Project documentation
- Internal how-to material

Company knowledge must remain versioned, reviewable, source-backed, and citation-first. It should always take precedence over general model knowledge for company-specific claims.

## 4. Central Context Assembler

Create one context-assembly service through which every model request passes. It should build a deterministic, token-budgeted context package.

A recommended ordering is:

1. System safety and grounding instructions
2. Agent settings and user instructions
3. Current conversation summary
4. Recent conversation turns
5. Query-relevant personal memories
6. Query-relevant company knowledge
7. Tool results
8. Reserved capacity for the response

The assembler should define a hard budget for each section. An initial policy could be:

| Context section | Initial policy |
| --- | --- |
| System and agent instructions | Fixed maximum |
| Recent conversation | Last 8–12 meaningful turns |
| Conversation summary | One bounded rolling summary |
| Personal memory | Up to 5 relevant entries |
| Company knowledge | Up to 4 diverse passages |
| Tool results | Truncated by tool-specific rules |
| Response capacity | Reserved before context is assembled |

The assembler should also record which context items were selected, their scores, and how many tokens each section used. This makes relevance and cost problems diagnosable.

## 5. Conversation Summaries

The current chat record should be extended with a durable summary mechanism. This can be implemented as fields on `Chat` or as a separate `ChatSummary` model.

Recommended summary data:

- `chatId`
- `summary`
- `summaryThroughMessageId`
- `decisions`
- `openTasks`
- `importantEntities`
- `activeConstraints`
- `summaryVersion`
- `createdAt`
- `updatedAt`

The summary should be updated incrementally:

1. Keep recent turns verbatim.
2. When the chat crosses a message or token threshold, summarize the oldest unsummarized turns.
3. Generate the next summary from the previous summary plus the new turn range.
4. Store the message boundary covered by the summary.
5. Exclude summarized messages from future prompts while retaining them in durable chat history.

Summaries should not silently create cross-chat personal memories. Personal-memory extraction remains a separate operation with stricter rules.

## 6. Personal Memory Lifecycle

Personal memory should support more states than saved and deleted.

Recommended fields:

| Field | Purpose |
| --- | --- |
| `status` | `ACTIVE`, `SUPERSEDED`, `DISPUTED`, `EXPIRED`, or `DELETED` |
| `canonicalKey` | Stable identity such as `preferred_response_style` |
| `confidence` | Confidence that the memory reflects an explicit user statement |
| `sourceChatId` | Chat from which the memory originated |
| `sourceMessageId` | Exact source message |
| `sourceExcerpt` | Short supporting excerpt when safe to retain |
| `supersedesId` | Previous memory corrected by this memory |
| `validFrom` | When the information became applicable |
| `validUntil` | Optional expiration time |
| `lastConfirmedAt` | Last explicit user confirmation |
| `lastUsedAt` | Last time the memory influenced a response |
| `useCount` | Number of times the memory was selected |
| `sensitivity` | Classification used for storage and retrieval policy |
| `extractionVersion` | Extractor and prompt version that created the memory |

Only active, non-expired memories should be eligible for ordinary retrieval.

When a user corrects a fact:

1. Create or identify the corrected memory.
2. Mark the previous entry as superseded.
3. Link the new entry to the previous entry.
4. Stop retrieving the previous entry.
5. Preserve enough provenance to explain the change.

Manual memories should remain authoritative over automatically extracted memories unless the user explicitly replaces them.

## 7. Idempotent and Conflict-Aware Memory Writes

Automatic extraction may run more than once because of retries, repeated completion callbacks, or future background processing. It must be safe to repeat.

Use an idempotency key based on:

```text
userId + sourceMessageId + extractorVersion
```

The extraction result should describe an operation rather than only returning new memory content:

- `CREATE`
- `REFINE`
- `SUPERSEDE`
- `IGNORE`
- `REQUEST_CONFIRMATION`

Recommended write flow:

1. Validate the extraction result.
2. Reject prohibited or highly sensitive content.
3. Check the idempotency key.
4. Compare the candidate with active memories using its canonical key.
5. Use semantic similarity to identify differently titled duplicates.
6. Detect contradictions.
7. Apply the operation in one transaction.
8. Retry safe serialization failures.
9. Invalidate shared caches.

A database uniqueness rule should prevent multiple active memories for the same user and canonical key when the category represents a single-valued fact or preference.

## 8. Relevant Personal-Memory Retrieval

Personal memories should be selected for the current request rather than globally ordered only by priority and recency.

A conceptual ranking formula is:

```text
memory score =
  semantic relevance
  + keyword relevance
  + user priority
  + confirmation confidence
  + recent usefulness
  - staleness
```

Memory retrieval should combine:

- Semantic similarity
- Full-text or keyword matching
- Tags and category filters
- User-controlled priority
- Lifecycle state
- Validity dates
- Recency of confirmation
- Prior successful use

A small number of user-pinned interaction preferences may be injected on every turn. All other personal memories should be retrieved for the current request.

The model should receive a bounded set of memories with stable identifiers, but it should not receive internal ranking scores or sensitive provenance fields unless required.

## 9. Cache Sustainability

An in-process memory cache becomes inconsistent when the application runs on multiple instances. A memory changed on one server can remain stale on another.

Recommended options, in increasing operational complexity:

1. Remove the cache while the memory query remains inexpensive.
2. Add a user-level `memoryRevision` value and include it in cache keys.
3. Use a shared cache such as Redis with revisioned keys.

Deletion, correction, and expiration must invalidate all application instances immediately. Cache correctness is more important than saving a small database query.

## 10. Company-Knowledge Retrieval

### 10.1 Perform One Initial Retrieval

The chat orchestration should avoid performing an automatic knowledge preflight search and then requiring the model to repeat the same tool search.

Recommended flow:

1. Determine whether company knowledge is applicable.
2. Run the initial retrieval once.
3. Give the retrieved evidence to the model as recorded tool or orchestration context.
4. Allow another search only when the model deliberately reformulates or narrows the query.
5. Record every retrieval attempt under one response trace.

This reduces embedding cost, latency, duplicate logs, and unnecessary rate-limit consumption.

### 10.2 Improve Ranking

Fixed weighted addition of vector similarity and full-text ranking should be replaced with a more stable ranking strategy.

Recommended improvements:

- Reciprocal-rank fusion or another rank-based hybrid method
- Query rewriting for internal acronyms and terminology
- Metadata filters for tags, source type, owner, audience, and date
- Diversity selection so results do not repeat the same passage
- Lightweight reranking of the candidate set
- Calibrated confidence and abstention thresholds
- Language-aware full-text search
- Separate thresholds for discovery and answer grounding

The system should distinguish:

- No relevant source exists
- A source exists but confidence is low
- Relevant sources conflict
- The relevant source is stale
- Retrieval failed operationally

These states should produce different user-facing responses and different operational metrics.

## 11. Durable Knowledge Ingestion

Knowledge ingestion should run in a durable worker rather than depending solely on request-lifecycle callbacks.

Required worker behavior:

- Queue-backed job claiming
- Claim leases and heartbeat timestamps
- Recovery of abandoned jobs
- Exponential retry with jitter
- Maximum attempt counts
- Dead-letter handling
- Bounded concurrency
- Batch embedding
- Cancellation support
- Progress reporting
- Operational alerts

Job processing should remain idempotent. A worker retry must not publish duplicate chunks or partially replace an approved version.

The system should publish a version only after every required chunk and embedding has been stored successfully. The previous approved version should remain searchable until the replacement is atomically approved.

## 12. Incremental and Content-Addressed Indexing

Store a normalized content hash for every chunk. When a source is rescanned:

1. Normalize and chunk the new document using a versioned chunking configuration.
2. Match new chunks to previous chunks by content hash.
3. Reuse embeddings for unchanged chunks.
4. Embed only new or modified chunks.
5. Mark removed chunks as absent from the new immutable version.
6. Publish the new version after validation and approval.

Each indexed version should record:

- Embedding provider
- Embedding model
- Embedding dimensions
- Embedding configuration version
- Chunker version
- Extractor version
- Retrieval schema version

This supports controlled reindexing and blue-green migration when embedding models or chunking rules change.

## 13. Knowledge Governance

Add governance fields before the corpus becomes large.

Recommended source metadata:

- Workspace or tenant
- Responsible owner
- Intended audience
- Confidentiality classification
- Effective date
- Expiration date
- Next-review date
- Authority or precedence level
- Superseded source
- Allowed teams or roles
- Retention policy

Scheduled maintenance should:

- Flag sources approaching review dates
- Exclude expired sources when policy requires it
- Notify responsible owners
- Detect broken URLs
- Identify sources that have not been used
- Identify conflicting or heavily overlapping sources
- Clean up orphaned stored files and archived embeddings according to retention policy

## 14. Evaluation

Create a permanent, version-controlled evaluation corpus with synthetic or safely anonymized data.

The evaluation set should cover:

- Correct personal-memory retrieval
- Exclusion of irrelevant memories
- Duplicate memory prevention
- User corrections and supersession
- Expired memories
- Conflicting personal memories
- Correct company-source retrieval
- Conflicting company sources
- Stale and expired company sources
- Knowledge-not-found behavior
- Citation correctness
- Unsupported company claims
- Prompt injection inside memories and documents
- Long-conversation summarization
- Information lost during compaction
- Multilingual queries where applicable

Track at least:

| Metric | Meaning |
| --- | --- |
| Recall@k | Whether expected evidence was retrieved |
| Ranking quality | Whether the best evidence appeared first |
| Citation correctness | Whether citations support their claims |
| Unsupported-claim rate | Company claims without sufficient evidence |
| Memory precision | Portion of selected memories that were relevant |
| Memory write precision | Portion of extracted memories worth retaining |
| Correction success | Whether outdated information stopped influencing answers |
| Abstention accuracy | Whether the assistant declined when evidence was absent |
| Context tokens per response | Prompt-growth and cost control |
| Retrieval latency | User-visible retrieval performance |
| Cost per grounded answer | Operational sustainability |

Every material prompt, embedding, chunking, or ranking change should run against this evaluation set before rollout.

## 15. Observability and Feedback

Retrieval traces should record:

- Response or trace ID
- User and workspace scope
- Query
- Query rewrite
- Retrieval mode
- Candidate chunk or memory IDs
- Component scores and final rank
- Selected context items
- Tokens by context section
- Embedding and reranking latency
- Final answer citation coverage
- User feedback
- Model, extractor, chunker, and retrieval versions

Avoid storing unnecessary sensitive prompt content. Apply retention limits to query and trace logs.

User-facing controls should include:

- Always remember
- Pin
- This changed
- Not relevant
- Forget
- Show what was remembered
- Show what informed this answer

Feedback should improve ranking rules and evaluation datasets. It should not silently modify authoritative company knowledge.

## 16. Privacy and Retention

Define explicit policies for:

- Chat retention
- Conversation-summary retention
- Automatically extracted personal-memory retention
- Manual personal-memory retention
- Query-log retention
- Audit-log retention
- Archived knowledge and original-file retention

Support:

- Exporting a user's memories
- Exporting relevant provenance
- Deleting all personal memories
- Deleting user chats and summaries
- Removing associated embeddings
- Invalidating all caches
- Cleaning up stored source files
- Redacting sensitive information before persistence

Sensitive categories should be prohibited or require explicit opt-in. Secrets, credentials, authentication data, financial account data, and similar information should never be stored as personal memory.

## 17. Recommended Implementation Order

The phase descriptions below explain the intended sequence at a strategic level. The executable source of truth is the [Sustainable Memory, Context, and Knowledge Implementation Plan](../plans/sustainable-memory-context/PLAN.md). Do not begin a later phase until the preceding phase acceptance gate in that plan passes.

### Phase 1: Bound and Stabilize Context

1. Create the central context assembler.
2. Add explicit token budgets.
3. Add rolling conversation summaries.
4. Keep only a recent-turn window in model context.
5. Record selected context and token usage.

**Expected outcome:** Predictable context size, lower cost, and coherent long conversations.

### Phase 2: Make Personal Memory Trustworthy

1. Add memory provenance and lifecycle fields.
2. Add canonical keys and idempotency.
3. Implement correction and supersession.
4. Add relevance-based memory retrieval.
5. Replace or remove the process-local cache.
6. Add inspection and correction controls.

**Expected outcome:** Fewer duplicates, fewer irrelevant memories, safer automatic extraction, and reliable user corrections.

### Phase 3: Scale Company Knowledge

1. Remove duplicate initial retrieval.
2. Add fused ranking, diversity, and reranking.
3. Move ingestion to a durable worker.
4. Batch embedding and database writes.
5. Add content-addressed chunk reuse.
6. Version embedding and chunking configurations.

**Expected outcome:** Lower latency and indexing cost with more reliable retrieval and recovery.

### Phase 4: Governance and Continuous Quality

1. Add workspace, audience, ownership, and review metadata.
2. Add source-expiration and stale-content workflows.
3. Build the permanent evaluation dataset.
4. Add retrieval and grounding dashboards.
5. Add user feedback loops.
6. Finalize privacy, export, deletion, and retention policies.

**Expected outcome:** An operable system whose accuracy and data quality can be maintained over time.

## 18. Initial Definition of Done

The first sustainable release should meet these conditions:

- Long chats do not grow the prompt without a defined bound.
- Old conversation details remain available through a rolling summary.
- Personal memories are selected by relevance, not only recency.
- Every automatic memory has source provenance and an idempotency key.
- User corrections stop outdated memories from influencing new answers.
- Manual memories take precedence over automatic extraction.
- Knowledge retrieval is not duplicated by orchestration and tool use.
- Failed ingestion jobs are recoverable after application restarts.
- Unchanged chunks do not require new embeddings.
- Company sources have an owner and review date.
- Evaluation tests detect retrieval, citation, correction, and compaction regressions.
- Users can inspect and delete the personal information influencing the assistant.

## 19. Key Risks to Avoid

- Building a single universal memory table without clear scopes
- Injecting every saved memory into every prompt
- Using model confidence as the only memory-quality signal
- Overwriting contradictions without retaining provenance
- Letting automatic memories override manual user entries
- Depending on request callbacks for durable indexing
- Changing embedding dimensions without a migration and reindexing strategy
- Evaluating only whether retrieval returned results
- Treating a successful citation format as proof that the claim is supported
- Adding multi-tenant scope only after company data has accumulated

## 20. Summary

The most valuable near-term work is:

1. A central, token-budgeted context assembler
2. Rolling conversation summaries
3. Personal-memory provenance, lifecycle, and idempotency
4. Query-relevant personal-memory retrieval

These changes establish the contracts on which the later worker, governance, evaluation, and optimization work depends. They should be implemented before expanding the number of memory categories, knowledge connectors, or autonomous extraction behaviors.
