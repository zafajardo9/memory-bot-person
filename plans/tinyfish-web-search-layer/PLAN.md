# TinyFish Web Search Layer

> **Status**: [ ] Planning | [ ] In Progress | [x] Implemented | [ ] Archived
>
> **Created**: 2026-09-01
>
> **Implemented**: 2026-09-01
>
> **Quick Checklist**:
> - [x] Requirements gathered
> - [x] Codebase analyzed
> - [x] Database changes reviewed (none required)
> - [x] Backend changes implemented
> - [x] Frontend changes implemented
> - [x] Tests passing
> - [x] Security reviewed
> - [ ] Deployed

## 1. Goal

Add TinyFish as a second, provider-registered web search layer so a single `webSearch` tool call can combine results from Tavily and TinyFish — labeled by source — giving users more independent data per query without any schema change.

## 2. Context Summary

### Confirmed repository facts

- The web toolkit (`lib/web/`) is provider-neutral: `WebSearchProvider` interface in `lib/web/types.ts`, factory map in `lib/web/registry.ts`, Tavily adapter in `lib/web/tavily.ts`, provider resolution hardcoded to `"tavily"` in `lib/web/service.ts`, feature flags in `lib/web/config.ts`, and atomic per-user quota in `lib/web/rate-limit.ts`.
- The toolkit plan (`plans/toolkit-expansion-user-memory/PLAN.md`) states the registry "remains additive for future providers."
- Integrations are defined in a typed object map (`lib/integrations/registry.ts`) with a single `tavily` entry; `IntegrationCredential` in Prisma stores `integrationId` as a free `String`, so no migration is needed for a new integration id.
- The credential API route (`app/(chat)/api/integrations/[integrationId]/route.ts`) and the `IntegrationCredentialCard` component are already generic over integration id.
- The `webSearch` tool (`ai/tools/web-search.ts`) hardcodes "Tavily" in its description; the tools page (`app/(chat)/tools/page.tsx`) hardcodes `tavilyStatus`, renders one credential card, and names Tavily in capability notes.
- `@tiny-fish/sdk` 0.5.0 is already installed (Node `>=18`, ESM-only, depends on zod 4 + p-retry). Its `search.query()` returns ~10 results per page with `title`, `url`, `snippet`, `position`, `date`, `publisher`, `authors`, `venue`, `year` — but no `score`, no `max_results` parameter, and no `search_depth`.
- TinyFish Search is free and does not draw from the wallet. `TINYFISH_API_KEY` is not yet present in `.env.example`, `.env.local`, or `scripts/validate-deployment-env.ts`.
- `WEB_SEARCH_ENABLED` defaults to false; the Tavily key is validated at deploy time only when web search is enabled.

### Assumptions for this plan

- The operator picks a mode via `WEB_SEARCH_PROVIDER` with three values: `tavily` (default, unchanged behavior), `tinyfish` (TinyFish only), `both` (query every configured provider and merge). Unknown values fall back to `tavily` at runtime and fail deployment validation.
- In `both` mode, results from all configured providers are merged, deduplicated by normalized URL (keeping the higher score), ordered by score descending, and labeled with the source provider via a new optional `source` field on `WebSearchResult`. Tavily and TinyFish adapters each set their own label.
- In `both` mode, a provider with no key is skipped; if no provider has a key, search is unconfigured and the tool is not exposed. If some providers fail during a search, successful results still return; only if every provider fails does the tool surface an error.
- TinyFish `searchDepth` has no equivalent; the option is ignored for TinyFish. `timeRange` maps to `recency_minutes` (day 1440, week 10080, month 43200, year 525600). Domain filters map to comma-separated `include_domains`/`exclude_domains`. `maxResults` is applied by slicing because the API has no result-count parameter.
- A derived `score` (`1 - position / 10`) fills the `WebSearchResult.score` contract since TinyFish does not return a relevance score.

### Open decisions to resolve before implementation

- None. Defaults above make the scope implementable without additional product decisions.

## 3. Scope

- Add `lib/web/tinyfish.ts`, a `WebSearchProvider` adapter wrapping `@tiny-fish/sdk`'s `TinyFish` client.
- Register `tinyfish` in `lib/web/registry.ts` alongside `tavily`.
- Add `lib/web/combined.ts` with a merge/dedupe/order provider for multi-provider search.
- Add `WEB_SEARCH_PROVIDER` parsing in `lib/web/config.ts` and mode-aware resolution in `lib/web/service.ts`.
- Register a `tinyfish` integration (label, `TINYFISH_API_KEY`, connection test) in `lib/integrations/registry.ts`.
- Generalize the `webSearch` tool description, add provider labels to its output, and keep the per-user daily quota on the combined call.
- Update the tools page to show both credential cards and provider-neutral copy.
- Update `.env.example` and `scripts/validate-deployment-env.ts`.
- Add unit tests for the TinyFish adapter, the combined provider, and updated registry expectations.

## 4. Out of Scope

- TinyFish Fetch (`fetch.getContents()`) replacing `readWebPage` extraction.
- TinyFish Agent/Browser sessions, Vault, wallet, or run history.
- Per-provider quotas or cost accounting; the existing daily quota applies once per tool call.
- A settings UI for choosing the provider mode; `WEB_SEARCH_PROVIDER` is operator configuration.
- Any database migration or new model.
- Changing the default mode away from `tavily`.

## 5. Affected Files and Folders

```txt
lib/
  web/
+   tinyfish.ts
+   combined.ts
~   registry.ts
~   types.ts
~   config.ts
~   service.ts
  integrations/
~   registry.ts
ai/
  tools/
~   web-search.ts
app/(chat)/
  tools/
~   page.tsx
scripts/
~ validate-deployment-env.ts
tests/unit/web/
+ tinyfish.test.ts
+ combined.test.ts
~ registry.test.ts
~ tavily.test.ts
~ .env.example
~ plans/AGENTS.md (active plan table)
~ plans/tinyfish-web-search-layer/PLAN.md
```

Important path notes:

- `lib/web/tinyfish.ts` is the only file that imports `@tiny-fish/sdk`; everything above it stays provider-neutral.
- `lib/web/combined.ts` composes existing `WebSearchProvider`s and never talks to an API directly.
- `lib/web/service.ts` keeps its public surface (`isWebSearchConfigured`, `getWebSearchProvider`) so `ai/tools/web-search.ts` and `ai/tools/index.ts` need only description/output updates.
- `app/(chat)/tools/page.tsx` renders one `IntegrationCredentialCard` per registered search provider; the card itself is unchanged.

## 6. Step-by-Step Implementation Plan

### 1. Extend the result contract

- **What to do**: Add an optional `source` field to `WebSearchResult`; set `source: "Tavily"` in the Tavily adapter.
- **Why**: Merged results must be attributable to their provider so the model can describe provenance.
- **Affected files**: `lib/web/types.ts`, `lib/web/tavily.ts`
- **Dependencies**: None.
- **Done when**: Tavily results carry `source: "Tavily"` and the field is optional everywhere.

### 2. Implement the TinyFish adapter

- **What to do**: Create a `WebSearchProvider` that instantiates `new TinyFish({ apiKey })`, maps `SearchQueryParams` from the common options (`recency_minutes` from `timeRange`, comma-joined domain filters, slicing to `maxResults`), maps `SearchResult` to `WebSearchResult` with a derived score and `source: "TinyFish"`, and converts SDK failures into safe messages.
- **Why**: The registry is additive by design; a second adapter demonstrates the contract without touching tool code.
- **Affected files**: `lib/web/tinyfish.ts`
- **Dependencies**: Step 1.
- **Done when**: Missing keys fail closed, option mapping is correct, and upstream failures never leak response bodies or keys.

### 3. Register the provider

- **What to do**: Add `["tinyfish", createTinyFishProvider]` to the factory map and the `tinyfish` integration definition with `environmentKey: "TINYFISH_API_KEY"` and a connection test that issues one search.
- **Why**: The integration registry drives credential UI and environment fallback; the provider registry drives resolution.
- **Affected files**: `lib/web/registry.ts`, `lib/integrations/registry.ts`
- **Dependencies**: Step 2.
- **Done when**: `listWebSearchProviderIds()` returns `["tavily", "tinyfish"]` and `saveIntegrationCredential("tinyfish", …)` validates against the live API.

### 4. Add combined-mode resolution

- **What to do**: Add `WEB_SEARCH_PROVIDER` parsing (`tavily` default, `tinyfish`, `both`) in `lib/web/config.ts`; add `createCombinedProvider` in `lib/web/combined.ts` (parallel `Promise.allSettled`, URL dedupe keeping higher score, score-desc ordering, per-result `source`, partial-failure tolerance, safe error when everything fails); make `lib/web/service.ts` mode-aware: `isWebSearchConfigured()` checks the active providers, `getWebSearchProvider()` returns the single provider or a combined one, and `listActiveWebSearchProviders()` reports which labels are live.
- **Why**: "Another layer" means both engines can answer one query; the mode flag keeps the change opt-in and backward compatible.
- **Affected files**: `lib/web/config.ts`, `lib/web/combined.ts`, `lib/web/service.ts`
- **Dependencies**: Steps 1 and 3.
- **Done when**: Default deployments behave exactly as before; `both` merges, dedupes, labels, and degrades gracefully.

### 5. Generalize the search tool

- **What to do**: Replace "with Tavily" in the tool description with provider-neutral copy, and include the active provider labels plus per-result `source` in the tool output and instruction text.
- **Why**: The model should know which engines were queried and that results are untrusted, labeled reference data.
- **Affected files**: `ai/tools/web-search.ts`
- **Dependencies**: Step 4.
- **Done when**: The description names no provider and the output tells the model which providers contributed.

### 6. Update the tools page

- **What to do**: Load both `tavily` and `tinyfish` credential statuses; enable the web-search capability when any configured provider is available; render a credential card per provider; make capability notes provider-neutral.
- **Why**: Users must be able to add the TinyFish key in the same place they add Tavily's, with accurate status.
- **Affected files**: `app/(chat)/tools/page.tsx`
- **Dependencies**: Steps 3 and 5.
- **Done when**: Two credential cards render under the web section and notes reflect "any configured provider".

### 7. Update configuration and deployment validation

- **What to do**: Add `TINYFISH_API_KEY` and `WEB_SEARCH_PROVIDER` to `.env.example` under the web-search section; validate in `scripts/validate-deployment-env.ts` that `WEB_SEARCH_PROVIDER` is one of the three values and that the selected mode has its required key(s) when `WEB_SEARCH_ENABLED=true`.
- **Why**: Operators need deterministic setup and deployment-time misconfiguration detection.
- **Affected files**: `.env.example`, `scripts/validate-deployment-env.ts`
- **Dependencies**: Steps 3 and 4.
- **Done when**: `pnpm validate:env` passes for valid combinations and fails for invalid modes or missing keys.

### 8. Test and verify

- **What to do**: Add `tests/unit/web/tinyfish.test.ts` (option mapping, result mapping, slicing, error translation) and `tests/unit/web/combined.test.ts` (merge, dedupe, ordering, partial failure, all-failure); update `tests/unit/web/registry.test.ts` and `tests/unit/web/tavily.test.ts` for the new expectations; run formatting, lint, typecheck, unit tests, Prisma validation, environment validation, and a production build.
- **Why**: New adapters and merge behavior can fail at type boundaries even when modules look correct.
- **Affected files**: `tests/unit/web/**`, implementation files as fixes require
- **Dependencies**: Steps 1–7.
- **Done when**: All repository checks pass or any environment-only limitation is explicitly documented with the exact failed command.

## 7. Database Changes

None. `IntegrationCredential.integrationId` is already a free `String`; no migration is required to add the `tinyfish` integration id.

## 8. Backend Changes

- `lib/web/tinyfish.ts` — TinyFish adapter using `@tiny-fish/sdk`.
- `lib/web/combined.ts` — multi-provider merge/dedupe/order provider.
- `lib/web/service.ts` — mode-aware provider resolution and active-provider reporting.
- `lib/web/config.ts` — `WEB_SEARCH_PROVIDER` parsing.
- `lib/integrations/registry.ts` — `tinyfish` integration definition with live connection test.
- `ai/tools/web-search.ts` — provider-neutral description, labeled output.
- `scripts/validate-deployment-env.ts` — mode and key validation.

## 9. Frontend Changes

- `app/(chat)/tools/page.tsx` — dual credential cards and provider-neutral web-search capability copy.

## 10. Validation Rules

- `WEB_SEARCH_PROVIDER` must be `tavily`, `tinyfish`, or `both`; anything else falls back to `tavily` at runtime and is rejected by deployment validation.
- `tavily` mode requires `TAVILY_API_KEY`; `tinyfish` mode requires `TINYFISH_API_KEY`; `both` mode requires at least one of the two (missing ones are skipped).
- Search query, result cap, time range, and domain filters keep their existing bounds; TinyFish results are sliced to `maxResults` (1–10).
- `timeRange` maps to `recency_minutes`; unsupported values produce no filter rather than an error.
- Merged results are deduplicated by normalized URL; equal-URL ties keep the higher score.
- A failed provider in `both` mode never fails the whole call; if all providers fail, the tool reports a safe combined error.
- API keys are only ever sent to the TinyFish API origin by the SDK; logs contain error summaries, not keys or response bodies.

## 11. Security Considerations

- The TinyFish key is stored through the existing encrypted integration credential flow or `TINYFISH_API_KEY` environment fallback; it never reaches the client.
- The adapter only calls the fixed TinyFish endpoints via the SDK; no new URL-fetch or SSRF surface is introduced.
- Web results remain labeled untrusted reference data and never override approved company knowledge.
- The existing per-user daily quota is enforced once per tool call regardless of how many providers answer.
- The tools page continues to hide masked keys and updater emails from non-admins.

## 12. Testing Plan

### Unit tests

- TinyFish: option mapping (`recency_minutes`, `include_domains`/`exclude_domains` as comma-joined strings), result mapping (position → derived score, snippet → content, date → publishedDate, `source: "TinyFish"`), slicing to `maxResults`, and safe error translation on failure.
- Combined: URL dedupe keeping higher score, score-desc ordering, `source` labels preserved, partial failure returns successes, all-failure throws a safe error.
- Registry: `listWebSearchProviderIds()` returns both providers; unsupported ids still throw.
- Tavily: updated expectations include `source: "Tavily"`.

### Integration tests

- Typecheck verifies the provider contract and SDK imports.
- Deployment env validation covers valid and invalid `WEB_SEARCH_PROVIDER` combinations.

### E2E/manual QA

- With `WEB_SEARCH_PROVIDER=both` and both keys, ask for current information and verify results are labeled Tavily/TinyFish and URLs are cited.
- With only one key in `both` mode, verify search still works with the configured provider.
- Add the TinyFish key via the tools page and verify the credential card shows Connected.
- Exhaust the daily quota and verify the next search is rejected without calling either provider.
- Run with `WEB_SEARCH_PROVIDER=tinyfish` and verify only TinyFish is queried.
- Disable `WEB_SEARCH_ENABLED` and verify the webSearch tool disappears.

## 13. Rollback Plan

- Set `WEB_SEARCH_PROVIDER` back to `tavily` (or unset it) — the default path, identical to pre-change behavior.
- Remove `TINYFISH_API_KEY` from the environment or delete the site-managed TinyFish credential.
- Revert application files if full removal is required; no database rollback is needed because no schema changed.

## 14. Final Checklist

- [x] Existing architecture and dirty worktree reviewed
- [x] Scope and defaults resolved
- [x] TinyFish SDK contract verified (search surface, ESM, Node engines)
- [x] TinyFish adapter implemented and registered
- [x] Combined provider implemented
- [x] Mode-aware service and config complete
- [x] Integration definition and credential card complete
- [x] Tool description and output provider-neutral
- [x] Environment example and deployment validation updated
- [x] Unit tests added and passing (205 tests total)
- [x] Lint and typecheck pass
- [x] Production build passes
- [ ] Plan status marked Implemented → deployed once TinyFish key is configured
