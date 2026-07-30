# Toolkit Expansion and Persistent User Memory

> **Status**: [ ] Planning | [ ] In Progress | [x] Implemented | [ ] Archived
>
> **Created**: 2026-07-29
>
> **Implemented**: 2026-07-29
>
> **Quick Checklist**:
> - [x] Requirements gathered
> - [x] Codebase analyzed
> - [x] Database changes reviewed
> - [x] Backend changes implemented
> - [x] Frontend changes reviewed (no UI changes required)
> - [x] Tests passing
> - [x] Security design reviewed
> - [ ] Deployed

## 1. Goal

Add provider-agnostic web research, durable private user memory, and a per-user agent profile to the existing company assistant. The finished system includes safe page reading with an optional JavaScript-rendered fallback, automatic high-confidence memory extraction, middleware-based memory injection, bounded usage, a user-facing settings experience for identity and response style, and production-ready tests and configuration.

## 2. Context Summary

### Confirmed repository facts

- The application is Next.js 16 with React 19, TypeScript, PostgreSQL, Prisma 7, Auth.js, Zod 4, Vitest, and AI SDK 7. The implemented dependency baseline uses AI SDK `7.0.41`, current compatible provider patches, and pnpm `11.15.1`.
- Chat models are selected per user through six adapters in `ai/providers/`; each adapter returns the common AI SDK `LanguageModel` interface.
- `streamCompanyChat()` owns prompt assembly and tool composition. The chat route persists completed `UIMessage[]`.
- Company knowledge already provides a proven tool pattern, feature flags, a Prisma data layer, HTML extraction, and DNS-aware SSRF protection.
- AI SDK 7 supports `wrapLanguageModel`, `LanguageModelMiddleware`, `generateText`, and schema-validated `Output.object()`.
- The worktree already contains unrelated, in-progress ImageKit storage changes. This implementation must preserve them.
- The original implementation required no client-side UI. The integrated scope now includes a user-facing agent and memory settings page so people can inspect and control their profile without relying on conversational tools.
- The existing plan’s “Phase 3” personal-file search and memory lifecycle ideas were explicitly labelled future work and are not acceptance criteria for this implementation.

### Assumptions for this plan

- `TAVILY_API_KEY` is the first web-search credential; the registry remains additive for future providers.
- Web search and user memory are enabled unless explicitly set to `false`, matching the existing knowledge feature-flag convention. Web tools are only exposed when Tavily is configured.
- Automatic extraction is disabled unless `AUTO_MEMORY_ENABLED=true`, because it creates an additional model call and stores inferred data.
- Automatic extraction uses the already resolved user model. A separately managed extraction-model configuration is deferred until provider settings can represent a second model purpose.
- A memory extraction is persisted only when it is durable, attributable to the user’s own message, and has confidence of at least `0.85`.
- Server-side completion callbacks are awaited; extraction errors are isolated and never prevent chat persistence or response completion.
- Relevant stable dependency updates will be applied and locked. Breaking major-version upgrades require their own migration plan.

### Open decisions to resolve before implementation

- None. Defaults above make the scope implementable without additional product decisions.

## 3. Scope

- Add a private `UserMemory` model related to `User`.
- Add durable, per-user daily web-search accounting.
- Add validated memory CRUD with ownership checks, a 200-memory cap, deduplication, cache invalidation, and priority ordering.
- Add `saveUserMemory`, `listUserMemory`, and `deleteUserMemory` AI tools.
- Load top user memories before chat and inject them through AI SDK middleware on every model step.
- Add structured automatic memory extraction after successful chat persistence.
- Add a registry-ready Tavily adapter, `webSearch`, and SSRF-safe `readWebPage`.
- Add a constrained `browseWebPage` fallback powered by Vercel Labs Agent Browser for public pages that require JavaScript rendering.
- Enforce a configurable per-user daily search limit.
- Gate web tools on explicit per-turn user consent, keep the approved Notebook first, and compare Notebook and external findings instead of blending them.
- Add a private `UserAgentSettings` profile with an agent name, a bounded mood preset, an answer-length preset, and custom behavior instructions.
- Add authenticated settings and memory-management routes, plus an agent settings page with add/delete memory controls.
- Apply the profile to every model response and show the configured name in the chat transcript and composer.
- Update assistant instructions, environment examples, deployment validation, documentation, and unit tests.
- Apply non-breaking dependency updates relevant to the implementation and regenerate Prisma artifacts.

## 4. Out of Scope

- Personal-file search.
- Admin access to another user’s memories or agent profile.
- Vector search, memory decay/archival, or semantic memory merging.
- Multiple web-search providers in the first release.
- A separately configurable extraction model.
- Agent avatars, voices, autonomous goals, or unrestricted prompt-template replacement.
- Interactive browser automation, authenticated browser profiles, arbitrary JavaScript execution, form entry, uploads, or cross-domain navigation.
- Deployment or production credential creation.

## 5. Affected Files and Folders

```text
ai/
~ chat/stream-chat.ts
~ custom-middleware.ts
+ memory/extraction.ts
~ prompts/company-assistant.ts
  tools/
~   index.ts
+   user-memory.ts
+   web-search.ts
app/(chat)/api/chat/
~ route.ts
app/(chat)/
+ settings/agent/page.tsx
  api/
+   agent-settings/route.ts
+   user-memory/route.ts
db/
+ agent-settings-queries.ts
+ memory-queries.ts
lib/
+ agent-settings.ts
  memory/
+   cache.ts
+   config.ts
+   preflight.ts
  web/
+   agent-browser-response.ts
+   agent-browser.ts
+   config.ts
+   extract.ts
+   rate-limit.ts
+   registry.ts
+   service.ts
+   tavily.ts
+   types.ts
prisma/
~ schema.prisma
  migrations/
+   20260729010000_toolkit_expansion_user_memory/migration.sql
+   20260729020000_user_agent_settings/migration.sql
components/
  custom/
~   chat.tsx
~   message.tsx
~   multimodal-input.tsx
~   navbar.tsx
~   navigation-links.tsx
  settings/
+   agent-settings.tsx
scripts/
~ validate-deployment-env.ts
tests/unit/
+ ai/memory-extraction.test.ts
+ ai/user-memory-tools.test.ts
+ memory/cache.test.ts
+ web/extract.test.ts
+ web/rate-limit.test.ts
+ web/registry.test.ts
+ web/tavily.test.ts
+ web/agent-browser.test.ts
~ .env.example
~ README.md
~ package.json
~ pnpm-lock.yaml
~ pnpm-workspace.yaml
~ plans/toolkit-expansion-user-memory/PLAN.md
~ vitest.config.ts
```

Important path notes:

- `db/memory-queries.ts` is the only direct CRUD boundary for user memories and always scopes reads, updates, and deletes by `userId`.
- `lib/memory/preflight.ts` formats bounded, escaped memory context; `ai/custom-middleware.ts` adds it as a system message for each provider call.
- `lib/web/extract.ts` reuses `lib/knowledge/url-security.ts`; it does not implement a second, weaker URL fetch path.
- `lib/web/rate-limit.ts` uses PostgreSQL so limits work across multiple server instances.
- `app/(chat)/api/chat/route.ts` awaits both chat persistence and optional extraction in its completion lifecycle.

## 6. Step-by-Step Implementation Plan

### 1. Lock the data contracts and migration

- **What to do**: Add `UserMemory` and `WebSearchUsage`, their user relations, indexes, constraints, cascade behavior, and an additive SQL migration. Generate the Prisma client.
- **Why**: Every memory and usage operation depends on stable generated types and ownership relations.
- **Affected files**: `prisma/schema.prisma`, `prisma/migrations/20260729010000_toolkit_expansion_user_memory/migration.sql`
- **Dependencies**: None.
- **Done when**: Prisma formatting, validation, generation, and migration SQL review pass without altering existing records.

### 2. Implement memory configuration, cache, and CRUD

- **What to do**: Add feature-flag and numeric-limit parsing; implement a short-lived per-user cache; implement create-or-update deduplication, list/search, delete, cap enforcement, and cache invalidation.
- **Why**: Tools, preflight, and extraction must share one validated and ownership-safe data layer.
- **Affected files**: `lib/memory/config.ts`, `lib/memory/cache.ts`, `db/memory-queries.ts`
- **Dependencies**: Step 1.
- **Done when**: All operations require `userId`, enforce bounds, and invalidate cached context after writes.

### 3. Implement memory tools and preflight formatting

- **What to do**: Create typed AI SDK tools and a bounded preflight formatter for the top 15 memories.
- **Why**: Users need explicit conversational control and the model needs context without an initial tool round trip.
- **Affected files**: `ai/tools/user-memory.ts`, `lib/memory/preflight.ts`
- **Dependencies**: Step 2.
- **Done when**: Invalid categories, IDs, lengths, priorities, and cross-user access cannot reach unscoped database operations.

### 4. Implement web provider and durable usage limiting

- **What to do**: Add common web types and registry, a Tavily adapter using bearer authentication and validated response parsing, provider resolution, feature configuration, and atomic per-user daily quota consumption.
- **Why**: Provider-neutral tools should not contain Tavily-specific request logic, and cost limits must hold across server instances.
- **Affected files**: `lib/web/types.ts`, `lib/web/registry.ts`, `lib/web/tavily.ts`, `lib/web/service.ts`, `lib/web/config.ts`, `lib/web/rate-limit.ts`
- **Dependencies**: Step 1.
- **Done when**: Missing keys fail closed, upstream failures have safe messages, and concurrent calls cannot intentionally bypass the configured daily allowance.

### 5. Implement safe web tools and rendered-page fallback

- **What to do**: Add `webSearch` and `readWebPage`; reuse public-URL validation, reject unsupported content types, strip active/unhelpful HTML, truncate output, and label all web content as untrusted. Add `browseWebPage` as a secondary, read-only Agent Browser path with a fresh isolated session, repeated launch-containment flags, same-domain validation, and guaranteed cleanup.
- **Why**: Web access introduces SSRF, prompt-injection, payload-size, and cost risks.
- **Affected files**: `lib/web/extract.ts`, `lib/web/agent-browser.ts`, `lib/web/agent-browser-response.ts`, `ai/tools/web-search.ts`, `ai/tools/agent-browser.ts`
- **Dependencies**: Step 4.
- **Done when**: Search returns source URLs and metadata; ordinary and rendered page reading cannot access private networks or return unbounded content; the browser tool cannot click, type, upload, authenticate, execute arbitrary JavaScript, reuse a profile, or leave a session running.

### 6. Integrate tools, prompt rules, and middleware

- **What to do**: Compose feature-flagged tools; wrap the selected model with user-specific memory middleware; update assistant rules for source precedence, citations, memory privacy, corrections, and explicit deletion.
- **Why**: A provider-agnostic integration point keeps behavior consistent across all six model adapters.
- **Affected files**: `ai/tools/index.ts`, `ai/custom-middleware.ts`, `ai/chat/stream-chat.ts`, `ai/prompts/company-assistant.ts`
- **Dependencies**: Steps 3 and 5.
- **Done when**: All providers receive the same tools and fresh memory context, while disabled or unconfigured capabilities are absent.

### 7. Implement automatic extraction

- **What to do**: Extract the latest completed user/assistant exchange, call `generateText` with `Output.object()`, filter low-confidence/non-durable entries, deduplicate via the memory data layer, and await it after chat persistence.
- **Why**: Durable context can be retained without depending entirely on the model choosing the save tool.
- **Affected files**: `ai/memory/extraction.ts`, `app/(chat)/api/chat/route.ts`
- **Dependencies**: Steps 2 and 6.
- **Done when**: The feature is opt-in, bounded to one extraction call per completed turn, and failures do not lose chat history.

### 8. Update configuration, dependencies, and documentation

- **What to do**: Document flags, quotas, Tavily credentials, Agent Browser installation, Node.js requirements, and persistent-compute deployment constraints; validate enabled production configuration; apply compatible stable dependency updates; update the lockfile.
- **Why**: Operators need deterministic setup, and the implementation must use supported dependency releases.
- **Affected files**: `.env.example`, `scripts/validate-deployment-env.ts`, `README.md`, `package.json`, `pnpm-lock.yaml`
- **Dependencies**: Steps 4 and 7.
- **Done when**: Fresh install and environment validation are deterministic and no required credential is undocumented.

### 9. Test and verify the integrated system

- **What to do**: Add unit tests for registries, Tavily mapping/errors, page extraction, cache behavior, tool boundaries, and extraction filtering; run formatting, lint, typecheck, tests, Prisma validation, environment validation where configured, and production build.
- **Why**: Cross-cutting tool and middleware changes can fail at type boundaries even when individual modules look correct.
- **Affected files**: `tests/unit/**`, all implementation files as fixes require
- **Dependencies**: Steps 1–8.
- **Done when**: All repository checks pass or any environment-only limitation is explicitly documented with the exact failed command.

### 10. Add the per-user agent profile and memory settings experience

- **What to do**: Add an additive one-to-one profile model; authenticated read/write APIs; a responsive settings page for name, mood, answer length, custom behavior, and memory management; and direct navigation from chat.
- **Why**: Conversational memory tools are useful but not sufficiently discoverable or inspectable. Users need an explicit, private control surface and visible confirmation that their selected identity is active.
- **Affected files**: `prisma/schema.prisma`, `prisma/migrations/20260729020000_user_agent_settings/migration.sql`, `lib/agent-settings.ts`, `db/agent-settings-queries.ts`, `app/(chat)/api/agent-settings/route.ts`, `app/(chat)/api/user-memory/route.ts`, `app/(chat)/settings/agent/page.tsx`, `components/settings/agent-settings.tsx`, chat and navigation components, `ai/chat/stream-chat.ts`
- **Dependencies**: Steps 1–3 and 6.
- **Done when**: Profile defaults require no setup; every read/write is scoped to the authenticated user; configured behavior reaches the system prompt with explicit instruction boundaries; the configured name appears in chat; memories can be added and deleted; desktop and mobile layouts are usable; tests and production build pass.

## 7. Database Changes

### `UserMemory`

- UUID primary key and required UUID `userId` foreign key with cascade delete.
- Required `title` (200), `content` text, tags array, category, priority, source, and timestamps.
- Indexes for `(userId, category)`, `(userId, priority, updatedAt)`, and case-insensitive query support through normal PostgreSQL filtering at the initial 200-row cap.
- Database checks constrain category, priority, source, and non-empty normalized title/content.
- No uniqueness constraint on raw text; application-level case-insensitive title matching updates an existing memory rather than inserting a duplicate.

### `WebSearchUsage`

- Composite primary key `(userId, day)`, integer count, and update timestamp.
- Cascade delete with the user.
- Quota consumption uses a transaction and a conditional update.

### `UserAgentSettings`

- One-to-one UUID primary/foreign key on `userId`, cascading on user deletion.
- Bounded `agentName`, enumerated mood and response-length values, custom instructions capped at 3,000 characters, and timestamps.
- Database check constraints mirror application validation, while application reads return a stable default profile without creating a row.

### Migration strategy

- The first additive migration creates memory and web-usage tables. A second additive migration creates the optional agent profile.
- No seed data and no changes to existing rows.
- Deploy with `pnpm db:deploy` before enabling memory or web search.
- Install the pinned Chrome-for-Testing runtime with `pnpm agent-browser:install` on any persistent host that enables `AGENT_BROWSER_ENABLED=true`; standard short-lived serverless functions are not a supported Agent Browser runtime.

## 8. Backend Changes

- Memory CRUD, cache, preflight, middleware, three AI tools, and automatic extraction.
- Tavily provider registry, two ordinary web tools, and a read-only Agent Browser rendered-page fallback.
- Daily usage accounting in PostgreSQL.
- Chat completion integration and environment validation.
- Authenticated agent-settings and memory-management routes derive ownership from the session and never accept a client-supplied user ID.

## 9. Frontend Changes

- `/settings/agent` provides identity and voice controls, a live profile preview, and private memory management.
- Agent name, mood, answer length, and custom behavior use explicit saved state with loading, success, validation, and failure feedback.
- The memory editor supports title, content, category, and tags; the list distinguishes manually saved and chat-learned items and confirms destructive deletion.
- Chat displays the configured agent name, uses it in the composer placeholder, and links directly to tuning controls.
- The account menu and desktop workspace navigation expose the settings page.
- The page uses a responsive two-column layout with a sticky preview on wide screens and a single flow on mobile.

## 10. Validation Rules

- Memory titles: trimmed, 1–200 characters.
- Memory content: trimmed, 1–4,000 characters.
- Tags: at most 10; each trimmed, non-empty, at most 50 characters; duplicates removed.
- Category: `fact`, `preference`, `context`, or `note`.
- Priority: integer from 0–10.
- Memory list limit: integer from 1–20; query at most 200 characters.
- Maximum stored memories: configurable, default 200 per user.
- Search query: trimmed, 1–500 characters; result count integer 1–10.
- Page URL: HTTP(S), no credentials, standard ports, public DNS/IP on every redirect.
- Page response: successful, supported textual content, and within existing 3 MB fetch limit; returned text is capped.
- Automatic extraction: latest user/assistant text only, bounded input size, at most five candidates, confidence `>=0.85`.
- Agent name: trimmed, 1–60 characters.
- Mood: `balanced`, `warm`, `upbeat`, `calm`, `direct`, or `analytical`.
- Answer length: `concise`, `balanced`, or `detailed`.
- Custom behavior instructions: trimmed and at most 3,000 characters.
- Tool and extraction errors return safe messages without leaking API keys, internal hosts, or provider response bodies.

## 11. Security Considerations

- Every memory query includes the authenticated `userId`; delete never accepts an ID without ownership scope.
- Memory context is labelled as data and wrapped in delimiters so stored prompt injection is not treated as instructions.
- Web content is labelled untrusted and never overrides approved company knowledge.
- Existing DNS resolution, private-address blocking, redirect validation, credential rejection, port restrictions, timeout, and response-size limits are reused for page reading.
- Tavily credentials stay server-side and are sent only in an authorization header to the fixed Tavily API origin.
- Per-user daily quota and result caps limit cost abuse.
- Automatic extraction is opt-in and only stores user-originated durable information above the confidence threshold.
- Logs contain error summaries, not memory content, full web content, or credentials.
- Agent settings and memory HTTP routes derive ownership only from the authenticated session; clients cannot submit a `userId`.
- Custom behavior is marked as a lower-priority user preference and cannot replace safety, privacy, source-authority, or tool-use rules.
- Public-web tools are omitted from the model toolset until the current turn contains a direct request or an affirmative reply to the assistant's web-research permission question.

## 12. Testing Plan

### Unit tests

- Web registry selection and unsupported provider behavior.
- Tavily request shape, response mapping, timeout, HTTP error, and malformed response behavior.
- HTML/text extraction, active element removal, unsupported content, and truncation.
- Memory cache hit, expiry, and invalidation behavior.
- Tool schema and ownership parameter forwarding.
- Extraction input selection, confidence filtering, maximum candidates, and no-op cases.
- Agent-setting defaults, validation bounds, preset rejection, and prompt-boundary formatting.

### Integration tests

- Prisma schema validation and client generation.
- Typecheck verifies AI SDK tool, middleware, and structured-output contracts.
- Database integration is covered by migration review; live migration requires a configured test PostgreSQL URL.

### E2E/manual QA

- Save a preference, start a new chat, and verify natural recall.
- Correct and delete a memory, then verify stale context is absent on the next model step.
- Search the web and verify URLs are cited and described as external sources.
- Read a public page and verify scripts/navigation are absent and output is bounded.
- Verify company knowledge remains authoritative when web results disagree.
- Disable each flag and verify its tools/behavior disappear.
- Exhaust the daily quota and verify the next search is rejected without calling Tavily.
- Rename the agent, change its tone and answer length, save, then verify the chat label, composer, and model behavior reflect the profile.
- Add and delete a memory from settings, then verify recall appears and disappears on subsequent model steps.
- Verify settings and memory controls at desktop and mobile widths, including empty, loading, error, full-capacity, and deletion-confirmation states.

## 13. Rollback Plan

- Disable `WEB_SEARCH_ENABLED`, `USER_MEMORY_ENABLED`, and `AUTO_MEMORY_ENABLED` first; the application then stops exposing or injecting the new capabilities.
- Revert application files and dependency lock changes.
- Leave additive tables in place for a non-destructive rollback.
- If schema removal is explicitly required after data retention approval, export `UserMemory`, then drop `WebSearchUsage` and `UserMemory` in a separately reviewed migration. Do not roll back by deleting production data implicitly.

## 14. Final Checklist

- [x] Existing architecture and dirty worktree reviewed
- [x] Scope and defaults resolved
- [x] AI SDK 7 contracts verified
- [x] Tavily API contract verified
- [x] Prisma models and additive migration complete
- [x] Memory CRUD, cache, tools, and middleware complete
- [x] Web provider, quota, extraction, and tools complete
- [x] Automatic extraction complete
- [x] Prompt, configuration, and documentation complete
- [x] Per-user agent profile, settings APIs, and memory management UI complete
- [x] Agent profile applied to model behavior and visible chat identity
- [x] Relevant dependencies updated and locked
- [x] Prisma format/validate/generate pass
- [x] Lint passes
- [x] Typecheck passes
- [x] Unit tests pass (57 tests across 16 files)
- [x] Production build passes
- [x] Manual QA procedure documented
- [x] Plan status marked Implemented
