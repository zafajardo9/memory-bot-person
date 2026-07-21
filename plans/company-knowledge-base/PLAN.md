# Company Knowledge Base with Grounded AI Tool Calling

> Implementation evolution (July 2026): the delivered product now includes a workspace-wide shared notebook. Every authenticated member can contribute notes, files, and links and manage their own contributions. Administrator approval remains required before a version becomes authoritative for AI retrieval. This supersedes the admin-only contribution assumption in the original plan below.

## 1. Goal

Build a company knowledge feature that lets authorized administrators add trusted files and links, deeply processes those sources into searchable knowledge, and requires the chat assistant to retrieve relevant company material through tools before answering work-related questions.

The assistant must treat approved company knowledge as the primary source of truth, cite the exact sources used, clearly distinguish optional general AI guidance from company policy, and state when the knowledge base does not contain enough information instead of inventing an answer.

## 2. Context Summary

Confirmed repository facts:

- The application uses Next.js 15, React 19, TypeScript, the App Router, and pnpm.
- Authentication uses Auth.js/NextAuth credentials with users stored through Prisma ORM.
- PostgreSQL is represented in `prisma/schema.prisma`, `db/queries.ts`, and checked-in Prisma migrations.
- Chat is streamed from `app/(chat)/api/chat/route.ts` with Vercel AI SDK 3 and Gemini 2.5 Pro.
- The chat route already exposes AI tools and supports multi-step tool calls.
- Gemini 2.5 Flash is used for structured generation in `ai/actions.ts`.
- Files are currently uploaded to Vercel Blob through `app/(chat)/api/files/upload/route.ts`, but that route is for chat attachments and only accepts JPEG, PNG, and PDF files up to 5 MB.
- Chats are scoped to their owning user. The current data model has no company, organization, role, or knowledge permissions.
- There is no automated test suite, background-job system, or knowledge retrieval layer yet.

Assumptions for this plan:

- Version 1 is for one company workspace. Every authenticated employee may query approved knowledge, but only administrators may manage it.
- Company knowledge will eventually use PostgreSQL with the `pgvector` extension. PostgreSQL full-text search and vector similarity will be combined for reliable hybrid retrieval.
- Knowledge ingestion is asynchronous so large files or links do not block a request.
- Initial supported sources are Markdown, plain text, PDF, DOCX, and public HTTP/HTTPS pages. Image OCR, spreadsheets, presentations, and authenticated third-party sites can be later extensions.
- Adding a link indexes a controlled snapshot. The assistant does not freely browse the web when answering.
- A URL import scans one page by default. Optional same-domain crawling must be explicitly enabled and bounded by page count and depth.
- Existing flight tools remain available during migration, but company-knowledge behavior becomes the primary chat behavior for company questions.

Open decisions to resolve before implementation:

- Confirm whether the product is permanently single-company or will need organization-level tenancy.
- Choose the embedding provider/model after verifying compatibility with the installed AI SDK; the current older SDK/provider versions may require a coordinated upgrade.
- Define the first administrator account and whether public self-registration should remain enabled for a company source-of-truth application.
- Confirm maximum source size, allowed link domains, ingestion retention period, and whether deleted source files must be recoverable.
- Decide whether employees need source-level access restrictions beyond the initial global approved knowledge set.

## 3. Scope

- An administrator-only knowledge management area.
- Uploading trusted files and adding trusted HTTP/HTTPS URLs.
- Source lifecycle states: draft, processing, approved, failed, archived, and deleted.
- Safe extraction and normalization of text while preserving headings, page numbers, section paths, and source URLs.
- Bounded deep scanning of source content, including optional same-domain link crawling.
- Content hashing, versioning, duplicate detection, rescanning, replacement, and archival.
- Semantic chunking and embedding generation.
- PostgreSQL/pgvector storage with PostgreSQL full-text search for hybrid retrieval.
- AI tools for searching the knowledge index and reading exact source excerpts.
- A source-first chat policy that requires retrieval before answering applicable company questions.
- Inline citations and a source panel so employees can verify answers.
- Clear separation between “Company knowledge” and “Additional general guidance.”
- Permission checks, audit events, ingestion status, observability, and rate limits.
- Feature flags and staged rollout.
- Automated and manual test coverage for ingestion, retrieval, grounding, authorization, and regressions.

## 4. Out of Scope

- Implementing the feature during this planning task.
- Using local JSON files or in-memory storage as the production source of truth.
- Autonomous internet research outside administrator-approved links.
- Unbounded website crawling or bypassing authentication/paywalls on external sites.
- OCR for images or scanned PDFs in the first release.
- Native parsing of spreadsheets, slide decks, audio, or video in the first release.
- Editing original knowledge documents from inside this application.
- Automatically approving AI-generated summaries as company policy.
- Replacing the existing authentication provider in the initial release.
- Multi-company tenancy unless the open tenancy decision requires it before implementation.
- Fine-tuning a language model; this feature uses retrieval-augmented generation and tool calling.

## 5. Affected Files and Folders

```txt
app/
  (admin)/
    knowledge/
      page.tsx
      new/page.tsx
      [id]/page.tsx
  (chat)/
    api/
      chat/route.ts
      knowledge/
        route.ts
        [id]/route.ts
        [id]/approve/route.ts
        [id]/rescan/route.ts
      knowledge-jobs/[id]/route.ts
    chat/[id]/page.tsx
ai/
  index.ts
  knowledge-tools.ts
  prompts/
    company-assistant.ts
components/
  custom/
    chat.tsx
    message.tsx
    navbar.tsx
  knowledge/
    knowledge-manager.tsx
    knowledge-source-form.tsx
    knowledge-source-list.tsx
    knowledge-source-status.tsx
    answer-citations.tsx
    source-preview.tsx
db/
  queries.ts
  knowledge-queries.ts
lib/
  auth/
    permissions.ts
  knowledge/
    types.ts
    validation.ts
    ingestion.ts
    extractors/
      markdown.ts
      text.ts
      pdf.ts
      docx.ts
      web-page.ts
    chunking.ts
    embeddings.ts
    retrieval.ts
    citations.ts
    url-security.ts
prisma/
  schema.prisma
  migrations/
    <new-knowledge-migration>/migration.sql
workers/
  knowledge-ingestion.ts
tests/
  unit/
    knowledge/
  integration/
    knowledge/
  e2e/
    knowledge-management.spec.ts
    grounded-chat.spec.ts
package.json
middleware.ts
README.md
.env.example
```

Important path notes:

- `app/(chat)/api/chat/route.ts` is the existing orchestration point and should register the new retrieval tools and grounding prompt.
- `ai/knowledge-tools.ts` should contain tool definitions, schemas, and execution adapters rather than making the already-large chat route larger.
- `lib/knowledge/` should hold framework-independent ingestion and retrieval logic that can be tested without rendering React components.
- `app/(admin)/knowledge/` is a new protected management surface. It must not reuse the ordinary chat attachment upload behavior.
- `db/knowledge-queries.ts` should isolate knowledge Prisma access from existing user/chat/reservation queries.
- `workers/knowledge-ingestion.ts` is a likely path for the asynchronous processor. The exact worker host can be selected during implementation.
- `.env.example` is a likely new file because the repository currently documents environment variables but does not include a checked-in example.
- Test paths are new because the repository currently has no automated test structure.

## 6. Step-by-Step Implementation Plan

1. Define the grounding contract and release acceptance criteria.
   - What to do: Document which questions require knowledge retrieval, what counts as an approved source, the required citation format, conflict behavior, and the exact separation between company facts and general AI guidance. Define that the model must never present general knowledge as company policy.
   - Why: “Source of truth” is a behavioral guarantee, not only a search feature. This contract drives prompts, tool behavior, tests, and UI.
   - Affected files: `ai/prompts/company-assistant.ts`, `lib/knowledge/types.ts`, test fixtures, and `README.md`.
   - Dependencies: Resolve tenancy and administrator assumptions first.

2. Perform an AI SDK and embedding compatibility spike.
   - What to do: Verify whether the installed AI SDK 3 and `@ai-sdk/google` version support the chosen embedding API and current Gemini models. Select an embedding dimension and provider. If an upgrade is required, plan it as one isolated dependency change and regression-test current streaming and flight tools.
   - Why: Vector column dimensions and embedding compatibility become database contracts. They should not be guessed or changed casually after indexing production content.
   - Affected files: `package.json`, `pnpm-lock.yaml`, `ai/index.ts`, and a temporary implementation note recorded in the plan or issue tracker.
   - Dependencies: Must finish before the database migration and embedding implementation.

3. Add company authorization and administrative roles.
   - What to do: Add an explicit user role with least-privilege defaults, include it in the Auth.js session, create reusable server-side permission checks, and protect all knowledge management pages and mutations. Decide how the initial admin is assigned safely.
   - Why: Any authenticated user can currently register. Allowing all users to modify the company source of truth would be unsafe.
   - Affected files: `prisma/schema.prisma`, `app/(auth)/auth.ts`, `lib/auth/permissions.ts`, `middleware.ts`, and a new migration.
   - Dependencies: Required before exposing any knowledge mutation endpoint.

4. Create the knowledge database schema and migrations.
   - What to do: Add source, source-version, chunk, ingestion-job, and audit/query-log tables; enable pgvector; add foreign keys, uniqueness rules, lifecycle constraints, full-text indexes, and a vector similarity index. Store source metadata and extracted text separately from vector chunks.
   - Why: The knowledge base needs durable versioning, traceability, safe replacement, and efficient hybrid retrieval.
   - Affected files: `prisma/schema.prisma`, `db/knowledge-queries.ts`, and `prisma/migrations/<new-knowledge-migration>/migration.sql`.
   - Dependencies: Requires the selected embedding dimension and an available PostgreSQL instance with pgvector.

5. Define source validation and lifecycle rules.
   - What to do: Create shared schemas for file uploads, URLs, crawl options, titles, tags, status transitions, and source visibility. Define allowed MIME types, byte limits, page limits, timeouts, and duplicate behavior. Require a successful scan before approval.
   - Why: Shared validation prevents the UI, routes, and worker from accepting inconsistent or unsafe content.
   - Affected files: `lib/knowledge/types.ts`, `lib/knowledge/validation.ts`, and knowledge API routes.
   - Dependencies: Align status values with the database constraints from step 4.

6. Build the knowledge source management APIs.
   - What to do: Add authenticated endpoints to list, create, inspect, approve, archive, delete, and rescan sources. Upload original files to a private or access-controlled Blob location, create a source/version record, and enqueue an ingestion job. Do not index knowledge through the ordinary chat upload route.
   - Why: Knowledge documents have a different trust level, lifecycle, retention policy, and permission boundary from chat attachments.
   - Affected files: `app/(chat)/api/knowledge/**`, `app/(chat)/api/knowledge-jobs/**`, `db/knowledge-queries.ts`, and `lib/auth/permissions.ts`.
   - Dependencies: Requires steps 3–5 and a selected job execution mechanism.

7. Implement secure file and URL extraction.
   - What to do: Extract text and structural metadata from Markdown, TXT, PDF, DOCX, and supported web pages. Preserve headings, page numbers, section hierarchy, canonical URL, and document title. For links, fetch server-side with strict URL controls, redirect limits, content limits, and timeouts. Strip scripts, navigation noise, and unsafe HTML.
   - Why: High-quality retrieval depends on clean content and accurate citation locations. URL ingestion also creates SSRF and resource-exhaustion risks.
   - Affected files: `lib/knowledge/ingestion.ts`, `lib/knowledge/extractors/**`, and `lib/knowledge/url-security.ts`.
   - Dependencies: Validation limits from step 5 must be finalized first.

8. Add bounded deep scanning and versioning.
   - What to do: For files, scan all supported pages/sections. For links, default to one page and optionally crawl same-origin links up to configured depth/page limits. Normalize URLs, avoid crawl loops, calculate content checksums, create immutable versions, and skip unchanged content on rescan.
   - Why: “Deep scan” must be thorough but deterministic, repeatable, and safe. Versioning ensures every answer can point to the exact indexed snapshot.
   - Affected files: `lib/knowledge/ingestion.ts`, `lib/knowledge/url-security.ts`, `workers/knowledge-ingestion.ts`, and `db/knowledge-queries.ts`.
   - Dependencies: Builds on extraction and database lifecycle support.

9. Implement semantic chunking and embedding.
   - What to do: Chunk normalized text by document structure before applying token-size limits and overlap. Keep section/page metadata on every chunk. Batch embedding requests, retry transient failures, and atomically publish a version only after all chunks succeed.
   - Why: Structure-aware chunks improve answer relevance and citations. Atomic publication prevents employees from searching a half-indexed source.
   - Affected files: `lib/knowledge/chunking.ts`, `lib/knowledge/embeddings.ts`, `workers/knowledge-ingestion.ts`, and `db/knowledge-queries.ts`.
   - Dependencies: Requires steps 2, 4, 7, and 8.

10. Implement hybrid retrieval and source expansion.
    - What to do: Combine PostgreSQL full-text ranking with vector similarity, merge results with a stable ranking method, apply approved/current-version filters, and return a small set of relevant chunks. Add a second operation that reads surrounding chunks or exact sections from selected sources for deeper understanding.
    - Why: Vector search alone can miss exact company terms, while keyword search can miss paraphrases. A search-then-read pattern gives the model both discovery and detailed evidence.
    - Affected files: `lib/knowledge/retrieval.ts`, `db/knowledge-queries.ts`, and `lib/knowledge/citations.ts`.
    - Dependencies: Requires indexed chunks and representative evaluation questions.

11. Add explicit AI knowledge tools.
    - What to do: Register tools such as `searchCompanyKnowledge`, `readCompanyKnowledge`, and optionally `listCompanyKnowledgeSources`. Tool outputs must contain stable source/version/chunk IDs, titles, excerpts, locations, and citation labels. Enforce authorization inside every tool execution, not only in the UI.
    - Why: Explicit tools make retrieval observable and controllable and satisfy the requirement that the assistant checks the supplied knowledge before answering.
    - Affected files: `ai/knowledge-tools.ts`, `app/(chat)/api/chat/route.ts`, `lib/knowledge/retrieval.ts`, and `lib/knowledge/types.ts`.
    - Dependencies: Requires step 10 and the grounding contract from step 1.

12. Update chat orchestration and prompts.
    - What to do: Classify company/work/process questions as retrieval-required, instruct the model to search and then read relevant sources, and prevent a final company answer when no knowledge tool was used. Require supported claims to carry citations. When evidence is absent, answer that the knowledge base does not contain the information and suggest which source should be added or updated. Put any general AI guidance in a separately labeled section and never let it override company knowledge.
    - Why: Retrieval must be mandatory for applicable questions; merely offering a tool does not guarantee the model will use it.
    - Affected files: `ai/prompts/company-assistant.ts`, `app/(chat)/api/chat/route.ts`, `ai/knowledge-tools.ts`, and `ai/index.ts`.
    - Dependencies: Requires tools and a tested response contract.

13. Add citation-aware message rendering.
    - What to do: Render citations next to supported claims, show source title and page/section/URL, and provide a source preview panel with the exact excerpt used. Label general AI additions visually. Add loading, no-evidence, stale-source, and tool-error states.
    - Why: Employees must be able to verify the answer against the company source of truth rather than trusting model prose.
    - Affected files: `components/custom/message.tsx`, `components/custom/chat.tsx`, `components/knowledge/answer-citations.tsx`, and `components/knowledge/source-preview.tsx`.
    - Dependencies: Tool result and citation schemas must be stable first.

14. Build the administrator knowledge UI.
    - What to do: Add file upload and URL forms, source list, status filters, progress display, failure details, metadata preview, approve/archive/rescan/delete controls, and a source-version history. Make approval an explicit action after previewing extracted content.
    - Why: The source of truth needs an understandable review and lifecycle workflow, not only an upload endpoint.
    - Affected files: `app/(admin)/knowledge/**`, `components/knowledge/**`, `components/custom/navbar.tsx`, and knowledge API routes.
    - Dependencies: Requires management APIs and permissions.

15. Add background processing, retries, and observability.
    - What to do: Run ingestion outside request/response execution, use idempotent job keys, record attempt counts and errors, retry transient failures with backoff, and expose progress. Log source changes and retrieval activity without storing unnecessary sensitive prompts. Add metrics for ingestion duration, failures, retrieval latency, no-evidence responses, and citation coverage.
    - Why: Deep scans and embedding calls can exceed serverless request limits and fail partially. Operational visibility is essential for a company-critical system.
    - Affected files: `workers/knowledge-ingestion.ts`, `db/knowledge-queries.ts`, job API routes, and deployment configuration.
    - Dependencies: Choose the deployment-compatible queue/worker mechanism before implementation.

16. Add evaluation fixtures and automated tests.
    - What to do: Create a small version-controlled synthetic knowledge corpus, expected questions, expected source IDs, prohibited unsupported answers, and conflicting/stale source cases. Add unit, integration, route, and end-to-end tests.
    - Why: Retrieval quality and grounding can regress even when TypeScript and endpoint tests pass.
    - Affected files: `tests/**`, test configuration, `package.json`, and synthetic fixtures under the test tree.
    - Dependencies: Retrieval and response contracts must be stable.

17. Roll out behind feature flags.
    - What to do: Add separate flags for knowledge management, indexing, and grounded chat. Deploy schema first, ingest a small approved corpus, validate retrieval with subject-matter experts, enable chat for an internal pilot, and expand only after citation and no-hallucination targets are met.
    - Why: A staged rollout prevents an incomplete index or prompt regression from becoming the apparent company source of truth.
    - Affected files: environment documentation, server configuration, chat route, admin navigation, and deployment settings.
    - Dependencies: All critical tests and operational dashboards must be ready.

18. Update developer and administrator documentation.
    - What to do: Document environment variables, pgvector setup, migrations, supported formats, ingestion limits, source approval, rescanning, citation semantics, backup/restore, and incident response.
    - Why: The system will only remain trustworthy if its content and operations are maintained consistently.
    - Affected files: `README.md`, `.env.example`, and a candidate `docs/knowledge-administration.md`.
    - Dependencies: Finalize deployment and operational choices first.

## 7. Database Changes

Enable the PostgreSQL `vector` extension and add the following logical entities through Prisma ORM and checked-in SQL migrations.

- Extend `User` with a role such as `member` or `admin`, defaulting to `member`.
- `KnowledgeSource`
  - Stable source identity and type (`file` or `url`).
  - Display title, canonical URL or Blob object reference, MIME type, tags, crawl configuration, lifecycle status, creator, timestamps, current approved version, and archival/deletion timestamps.
  - Unique canonical URL rules for link sources where appropriate.
- `KnowledgeSourceVersion`
  - Immutable source snapshot with source ID, version number, content checksum, extracted metadata, extraction/index status, failure details, creation time, approval information, and original fetch/update timestamps.
  - Unique constraint on source ID plus version number and a duplicate check on source plus checksum.
- `KnowledgeChunk`
  - Version ID, ordinal, text, heading/section path, page number or anchor, token count, full-text search column, embedding vector, and citation metadata.
  - Unique constraint on version ID plus ordinal.
  - GIN index for full-text search and an appropriate pgvector similarity index after confirming expected corpus size and distance metric.
- `KnowledgeIngestionJob`
  - Source/version ID, state, current stage, attempt count, progress, error code/message, idempotency key, and started/completed timestamps.
  - Unique idempotency key to prevent duplicate scans.
- `KnowledgeAuditEvent`
  - Actor, source/version, action, timestamp, and minimal metadata for create, approve, archive, rescan, replace, and delete events.
- Optional `KnowledgeQueryLog`
  - User/chat, normalized query, retrieved source/chunk IDs, latency, outcome, and timestamp.
  - Store only what is needed for quality and audit analysis; apply a defined retention period and avoid duplicating sensitive answer text.

Relationships and integrity rules:

- A source has many immutable versions and at most one current approved version.
- A version has many chunks and ingestion jobs.
- Only chunks belonging to the current approved version of a non-archived source are searchable.
- Publishing a version and switching `currentApprovedVersionId` must occur atomically.
- Deleting/archiving a source must remove it from retrieval immediately; physical Blob and chunk deletion may occur through a controlled cleanup job.
- Migrations must be backward compatible while the feature flag is off.
- Database backup/restore must include vector data, source/version metadata, audit events, and the mapping to Blob objects.

## 8. Backend Changes

- Extract knowledge tool definitions from the chat route so schemas and execution logic are independently testable.
- Add a central grounding prompt and response/citation contract.
- Add server-only permission helpers for administrator and employee access.
- Create knowledge CRUD and lifecycle routes with Zod validation and consistent error responses.
- Add a private knowledge upload path and signed/authorized source access; do not rely on public Blob URLs for internal company files.
- Add secure URL validation and fetching with DNS/IP checks, redirect revalidation, timeouts, response-size limits, content-type checks, and crawl boundaries.
- Add parser adapters that return one normalized document format with structural metadata.
- Add an asynchronous, idempotent ingestion pipeline with observable stages: queued, fetching, extracting, chunking, embedding, indexing, awaiting approval, approved, or failed.
- Add hybrid retrieval restricted to approved current versions and authorized sources.
- Add search and source-reading AI tools with bounded inputs and outputs.
- Enforce the source-first policy in orchestration and validate final answers for citations when company claims are made.
- Record source lifecycle audit events and privacy-conscious retrieval metrics.
- Add feature flags and graceful behavior when PostgreSQL, pgvector, embeddings, or the worker is unavailable.

## 9. Frontend Changes

- Add an administrator-only “Knowledge” navigation item.
- Add a knowledge dashboard showing source name, type, status, version, creator, last scan, and errors.
- Add separate file and URL creation forms with clear supported-format, size, crawl-depth, and domain-limit guidance.
- Show upload and ingestion progress; polling with SWR is consistent with current project patterns.
- Allow administrators to preview extracted text and metadata before approval.
- Add rescan, replace, approve, archive, and delete confirmations with clear consequences.
- Add source version history and indicate which version is currently authoritative.
- Render chat citations with source title and precise location.
- Add a source-preview sheet/modal containing the exact retrieved passage and a safe link to the approved source.
- Visually label “Additional general guidance” so it cannot be mistaken for company policy.
- Provide explicit chat states for no supporting knowledge, conflicting sources, source-processing failures, and temporarily unavailable retrieval.
- Maintain responsive layout, keyboard navigation, screen-reader labels, focus management, and dark-mode compatibility.

## 10. Validation Rules

- Require authentication for every knowledge read or mutation endpoint.
- Require administrator role for create, approve, rescan, archive, replace, and delete actions.
- Accept only allowlisted file extensions and verified MIME signatures; do not trust filenames or client-provided MIME types.
- Enforce configured per-file size, extracted-text size, PDF page, crawl-page, crawl-depth, redirect, and processing-time limits.
- Support Markdown, TXT, PDF, and DOCX initially; reject unsupported formats with an actionable message.
- Accept only absolute HTTP/HTTPS URLs.
- Reject URLs with credentials, fragments-only targets, disallowed ports, localhost, loopback, link-local, multicast, private network ranges, and cloud metadata endpoints.
- Revalidate every redirected URL and resolved address before fetching.
- Restrict crawling to the approved origin by default and normalize canonical URLs to avoid duplicates.
- Reject empty or effectively unreadable documents and require a meaningful title.
- Calculate a content checksum and avoid creating a new version for unchanged content.
- Preserve page/section location for every chunk used in a citation.
- Limit tool query length, filter count, result count, excerpt length, and total retrieved context.
- Search only approved, current, non-archived source versions.
- Require at least one valid citation for every answer that makes a company-specific claim.
- If approved sources conflict, prefer no silent resolution: surface the conflict and cite both until an administrator updates priority or archives the stale source.
- General AI guidance must be separately labeled and must not contradict approved knowledge.

## 11. Security Considerations

- Keep knowledge management admin-only and default all new users to the least privileged role.
- Reconsider public self-registration before company rollout; use an invitation or controlled provisioning flow if the application contains internal information.
- Apply authorization at page, API route, database query, Blob access, worker, and AI tool layers.
- If multi-company tenancy is required, add `organizationId` to every knowledge table and every retrieval predicate before storing production data; do not retrofit tenant boundaries after launch.
- Store company files in private storage and provide short-lived authorized access rather than public URLs.
- Treat uploaded files and fetched pages as untrusted input. Scan for malware where the storage platform permits and parse within strict resource limits.
- Defend URL ingestion against SSRF, DNS rebinding, redirect abuse, decompression bombs, oversized responses, and crawler loops.
- Treat instructions found inside knowledge documents as data, not system instructions. The model must ignore prompt-injection text embedded in sources.
- Sanitize extracted HTML and safely render citations/previews to prevent XSS.
- Do not expose raw database IDs, Blob credentials, internal stack traces, or source content to unauthorized users.
- Add rate limits for uploads, URL scans, rescans, retrieval tools, and chat requests.
- Encrypt data in transit and use provider encryption at rest; rotate API and storage secrets.
- Audit source-of-truth changes with actor and version information.
- Define retention and deletion policies for original files, versions, chunks, logs, and backups.
- Avoid sending highly sensitive sources to an embedding/model provider until company data-processing and retention requirements are confirmed.
- Review citations for access-control leakage if source-level permissions are introduced.

## 12. Testing Plan

Unit tests:

- Validate every supported and rejected file/URL case.
- Test URL normalization, redirect handling, private-IP blocking, same-origin crawl rules, and crawl limits.
- Test Markdown, TXT, PDF, DOCX, and HTML extraction with headings, pages, Unicode, empty files, corrupted files, and oversized inputs.
- Test structure-aware chunking, overlap, token bounds, stable ordering, and citation metadata.
- Test checksum deduplication, version transitions, approval rules, and idempotent retries.
- Test hybrid result merging, filtering to approved/current versions, ranking, result limits, and surrounding-chunk expansion.
- Test citation creation and rejection of unknown source/chunk references.
- Test prompt rules for source-first answers, no-evidence responses, conflict handling, and labeled general guidance.

Integration tests:

- Run migrations against PostgreSQL with pgvector enabled.
- Upload each supported file type, complete ingestion, approve it, retrieve it, rescan an unchanged version, and replace it with changed content.
- Add a URL, verify bounded fetching, ingest it, and confirm citations point to the snapshotted URL/version.
- Verify partial indexing never becomes searchable.
- Verify archiving or deleting a source immediately removes it from results.
- Verify full-text, vector, and combined retrieval return expected fixtures.
- Verify AI tools cannot access draft, failed, archived, or unauthorized sources.
- Verify a company question triggers search/read tools before the final response.
- Verify a question with no evidence does not produce invented company policy.

Permission tests:

- Unauthenticated users cannot query or manage knowledge.
- Members can query approved knowledge but cannot access administration routes or mutations.
- Administrators can manage sources.
- Changing a client request or tool arguments cannot bypass server-side authorization.
- If tenancy is added, users cannot infer or retrieve another organization's sources through search, direct IDs, citations, or logs.

End-to-end tests:

- Administrator uploads an “Outline Work” file, previews it, approves it, and sees it become ready.
- Employee asks “What is the work and how should I do it?” and receives a grounded answer with citations to the relevant outline sections.
- Employee opens a citation and verifies the exact excerpt.
- Employee asks for details absent from the outline and receives an explicit knowledge gap plus separately labeled optional general guidance.
- Administrator replaces the outline, approves the new version, and subsequent answers use only the new version.
- Failed ingestion displays a safe, actionable error and can be retried.
- Mobile, desktop, light mode, dark mode, keyboard, and screen-reader flows remain usable.

Regression tests:

- Existing sign-in, registration, chat streaming, chat history, deletion, file attachments, weather tool, and flight tools continue to work as intended.
- Tool-call persistence and restored chat messages still render correctly with knowledge citations.
- Builds and migrations succeed both before and after enabling the knowledge feature flags.

Quality evaluation:

- Maintain a versioned question set with expected source/version IDs and key facts.
- Track retrieval recall, citation precision, unsupported-claim rate, no-evidence accuracy, latency, and tool failure rate.
- Require subject-matter expert review before declaring the system the company source of truth.

## 13. Rollback Plan

- Keep knowledge management, indexing, and grounded-chat behavior behind independent feature flags.
- Deploy additive database changes before application code; do not remove or alter existing chat columns during the initial rollout.
- If chat quality or retrieval fails, disable grounded-chat integration while leaving ingestion data intact for diagnosis.
- If ingestion fails, disable new source creation/rescans and keep the last approved versions searchable.
- If a new source version is incorrect, atomically point the source back to the previous approved version and archive the bad version.
- If an AI SDK upgrade causes regressions, revert the dependency and model integration as one isolated change; embeddings already stored must remain associated with their provider/model/version so incompatible vectors are not mixed.
- Roll back application code before reversing schema changes. Keep additive knowledge tables during the observation window unless data policy requires deletion.
- Back up PostgreSQL and Blob objects before destructive migrations or bulk re-indexing.
- For permanent removal, disable retrieval first, export required audit records, delete chunks/versions and Blob objects through a controlled job, and verify backup/retention obligations.
- Document restoration steps and test that a backup restores source/version/chunk relationships and active-version pointers.

## 14. Final Checklist

- [ ] Plan reviewed
- [ ] Files identified
- [ ] Database changes checked
- [ ] Backend changes checked
- [ ] Frontend changes checked
- [ ] Validation rules checked
- [ ] Security considerations checked
- [ ] Tests planned
- [ ] Rollback plan reviewed
- [ ] Assumptions and open questions resolved
