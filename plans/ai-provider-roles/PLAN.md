# AI Provider Roles — Dedicated Research Model for Tool Calling

> **Extended by**: [`plans/answer-humanizer-flow/PLAN.md`](../answer-humanizer-flow/PLAN.md), which removes chat-level provider/model selection and replaces the user-selected writer with workspace Thinking and optional Humanizer roles.

> **Status**: [ ] Planning | [ ] In Progress | [x] Implemented | [ ] Archived
>
> **Created**: 2026-08-13
>
> **Implemented**: 2026-08-14
>
> **Quick Checklist**:
> - [x] Requirements gathered
> - [x] Codebase analyzed
> - [x] Database changes reviewed
> - [x] Backend changes implemented
> - [x] Frontend changes implemented
> - [x] Tests passing
> - [x] Security reviewed
> - [ ] Deployed

## 1. Goal

Let administrators assign a dedicated, workspace-wide **research model** that runs all tool calling and evidence gathering (knowledge search, web research, memory), while the user-selected **chat model** remains the one that writes the final answer — completing the provider-role model alongside the existing embedding role.

## 2. Context Summary

### Confirmed repository facts

- `/settings/ai` is an admin-only page (`app/(admin)/settings/ai/page.tsx`) with two tabs: **AI providers** (`ProviderDirectory`) and **AI configuration** (`KnowledgeAISettingsPanel`).
- Provider connections: 8 built-in adapters (`ai/providers/registry.ts`: google, openai, anthropic, deepseek, mistral, groq, huggingface, zhipu) plus admin-created OpenAI-compatible custom providers. Each adapter implements `AIProviderAdapter` from `ai/providers/types.ts`.
- Model catalog: `AIProviderModel` has `id`, `label`, `description`, `chatCapable`, `custom`, and token-limit fields — there is **no** tool-calling or role capability flag.
- Embedding role (workspace-wide) is already built: `KnowledgeAiConfig` table, `lib/knowledge/embedding-settings.ts` (`getKnowledgeAISettings` / `saveKnowledgeAISelection` / `resolveKnowledgeEmbeddingEngine`), admin route `app/(chat)/api/ai/knowledge/route.ts`, and the `KnowledgeAISettingsPanel` UI. This plan mirrors that pattern exactly.
- Chat role (per-user, with per-agent override) is already built: `UserAiSelection` + `Agent.providerId/modelId`, `getAIProviderCatalog` / `saveUserAISelection` / `resolveUserLanguageModel` in `ai/providers/service.ts`, route `app/(chat)/api/ai/selection/route.ts`, and the composer's `ModelSelector`.
- `ai/chat/stream-chat.ts` uses a **single** model for everything: `resolveUserLanguageModel` produces `selected.model`, which drives `streamText` (tools + `stopWhen: stepCountIs(14)` + `prepareStep`), the knowledge preflight rerank, and memory extraction. There is no way to assign tool calling to a different model.
- `searchCompanyKnowledge` already accepts an optional `rerankModel: LanguageModel` — precedent for using a second model inside the pipeline.
- The user-selected model is resolved once per request and returned as `{ selection, extractionModel, memoryEnabled }` to the chat route.
- Credentials are resolved per provider via `getProviderApiKey` (site-encrypted key or environment fallback); nothing new is needed to authenticate a second provider.
- The worktree contains active user changes and prior plans; implementation must stay additive (new tables/columns, no drops, no required columns, no data loss) — the same constraint honored by the research-engine plan.
- `docs/ai-providers.md` documents the current single-model architecture; it must be updated so it does not contradict the new role model.

### Assumptions for this plan

- The research model is **workspace-wide**, exactly like the embedding selection, in v1. Per-agent/per-user research overrides are future work.
- Any enabled provider's chat-capable model that also supports tool calling can be chosen as the research model; a new `toolCallingCapable` flag on `AIProviderModel` makes this explicit and filterable.
- When no research model is configured (or its provider becomes unavailable), chat silently falls back to today's behavior — the user-selected model does both research and answering. No chat request may hard-fail because of research-model configuration.
- The research loop must keep the existing live tool-activity timeline. This drives the phase-1 streaming design (relay research tool parts, then stream the writer answer) and is validated by a spike in Step 6 before finalizing.
- Memory extraction after a completed response continues to use the user's chat model (unchanged).
- The embedding role is complete and untouched; this plan only references it as the pattern to copy.

### Open decisions to resolve before implementation

- [x] **Scope of the role model**: implemented a dedicated `WorkspaceAiConfig` singleton with `research*` columns; a generic role table remains future work.
- [x] **Streaming UX during the research phase**: live tool/source parts are relayed into one assistant message; research narrative is hidden and the writer continues the same message.
- [x] **Research step budget**: research uses up to 10 steps; the writer is a separate tool-free answer phase. The fallback retains the original 14-step budget.
- [x] **Which models get `toolCallingCapable: true`**: populated explicitly across built-in and custom adapters and filtered by the research service.
- [x] **Flag name**: implemented `toolCallingCapable`.

## 3. Scope

- A `toolCallingCapable` capability flag on `AIProviderModel`, set per model across all provider adapters and custom providers.
- A new additive `WorkspaceAiConfig` table storing the workspace research-provider/model selection with audit fields.
- A research-config service mirroring `lib/knowledge/embedding-settings.ts`: read, save (validated), and resolve (with fallback).
- An admin-only `GET`/`PUT` route for the workspace research selection.
- A **Research & tool calling** settings panel in the AI configuration tab at `/settings/ai`, with an attention indicator when no research model is set.
- Two-phase chat orchestration in `stream-chat.ts`: research model runs the tool loop; the user-selected chat model writes and streams the final answer with the research transcript as context.
- Backward-compatible fallback to the single-model path whenever no research model is configured.
- Documentation updates (`docs/ai-providers.md`, `README.md`).
- Tests: config service, capability flags, orchestration fallback, settings panel behavior.

## 4. Out of Scope

- Per-user or per-agent research-model selection (future work; the per-agent writer override already exists and is unaffected).
- Changing the embedding role, its table, or its UI beyond reusing its pattern.
- Changing which tools exist or their behavior; the research model simply *drives* the same tools.
- Model routing for memory extraction, summarization, or re-ranking beyond the research loop (the rerank inside `searchCompanyKnowledge` uses the resolved research model as a natural consequence).
- A generic multi-role config table (documented as the future refactor).
- Auto-provisioning provider keys or any new credential storage.
- Changes to the user-facing chat model selector.

## 5. Affected Files and Folders

```txt
plans/
  ai-provider-roles/
+   PLAN.md                        This plan
AGENTS.md
+   Agent instructions + plans index (all agents discover plans here)
CLAUDE.md
+   Claude Code entry point (imports AGENTS.md)
ai/
  providers/
~   types.ts                       AIProviderModel.toolCallingCapable
~   anthropic.ts                   Set toolCallingCapable per model
~   deepseek.ts
~   google.ts
~   groq.ts
~   huggingface.ts
~   mistral.ts
~   openai.ts
~   openai-compatible.ts           Custom providers default toolCallingCapable true
~   zhipu.ts
+   research-settings.ts           Workspace research-model config service
~   service.ts                     Small additions: catalog/filter support if needed
  chat/
~   stream-chat.ts                 Two-phase research → answer orchestration + fallback
app/
  (chat)/
    api/
      ai/
+       workspace/route.ts         Admin GET/PUT workspace research selection
  (admin)/
    settings/
      ai/
~       page.tsx                   Load workspace research settings
components/
  settings/
~   ai-provider-settings.tsx       Render research panel; attention dot on config tab
+   research-ai-settings.tsx       Research & tool calling panel (mirrors KnowledgeAISettingsPanel)
prisma/
~   schema.prisma                  WorkspaceAiConfig model + relation
+   migrations/                    Additive migration (new table only)
docs/
~   ai-providers.md                Document three-role architecture
README.md
~   Project structure + AI settings section
tests/
  unit/
    ai/
~     providers.test.ts            toolCallingCapable assertions
+     research-settings.test.ts    Config resolution, validation, fallback
```

**Important path notes**

- `ai/providers/research-settings.ts` is the mirror of `lib/knowledge/embedding-settings.ts`: it owns the provider option list, selection validation, and `resolveWorkspaceResearchModel()` that returns a ready `LanguageModel` (or `null` when unset). It lives in `ai/providers/` because it consumes the adapter registry directly (embedding settings live under `lib/knowledge/` because knowledge consumes them).
- `ai/chat/stream-chat.ts` is the only runtime behavior change: resolving a second model, splitting the loop into research (tool calling) and answer (writing), and preserving the streamed tool timeline.
- `components/settings/research-ai-settings.tsx` mirrors `KnowledgeAISettingsPanel` (provider/model selects, dirty state, save, provider-not-ready warning) so the two panels share visual and interaction language.
- `app/(chat)/api/ai/workspace/route.ts` mirrors `app/(chat)/api/ai/knowledge/route.ts` (admin-only, Zod-validated PUT, `NextResponse.json` of the saved settings).
- `prisma/schema.prisma` gains one new model and one relation to `User`; the migration is purely additive.

## 6. Step-by-Step Implementation Plan

### Step 1 — Add the tool-calling capability flag to the model catalog

- **What to do**: Add `toolCallingCapable: boolean` to `AIProviderModel` in `ai/providers/types.ts` (default semantics: chat-capable models are assumed tool-calling capable unless a provider adapter marks otherwise). Set the flag in every provider adapter's `listModels` output (anthropic, deepseek, google, groq, huggingface, mistral, openai, zhipu) and default it to `true` for custom-provider models in `ai/providers/openai-compatible.ts`. For providers whose discovery filters already exclude non-chat models (e.g. OpenAI), mark tool-calling capable explicitly where the model supports tool use.
- **Why**: The settings UI needs to know which models may be chosen as the research model, and the backend must validate selections against it. Without a flag, any chat model could be selected even if it cannot drive tools.
- **Affected files**: `ai/providers/types.ts`, `ai/providers/*.ts` (all adapters), `ai/providers/openai-compatible.ts`.
- **Dependencies**: none.
- **Done when**: `toolCallingCapable` is present on every catalog model; `tests/unit/ai/providers.test.ts` asserts the flag for a representative sample (e.g. OpenAI filters keep tool-capable chat models, custom models default true).

### Step 2 — Add the workspace AI config model and migration

- **What to do**: Add `WorkspaceAiConfig` to `prisma/schema.prisma`: `id String @id @default("workspace") @db.VarChar(30)`, `researchProviderId String @db.VarChar(50)`, `researchModelId String @db.VarChar(200)`, `updatedById String @db.Uuid`, `updatedAt DateTime @updatedAt`, relation to `User` ("WorkspaceAIConfigUpdater"). Generate and run an additive migration (new table only; no changes to existing columns).
- **Why**: Mirrors `KnowledgeAiConfig` so research selection persists workspace-wide with an audit trail and consistent shape.
- **Affected files**: `prisma/schema.prisma`, `prisma/migrations/*`.
- **Dependencies**: Step 1 (type contract referenced by the service in Step 3).
- **Done when**: `pnpm prisma migrate dev` produces a clean additive migration and `pnpm typecheck` passes.

### Step 3 — Workspace research config service

- **What to do**: Create `ai/providers/research-settings.ts` exposing:
  - `getWorkspaceAISettings()` → `{ selection, providers, updatedAt, updatedBy }` where `providers` are enabled+configured provider statuses with their `toolCallingCapable` models (reusing `getProviderStatus` / `getProviderModels`), falling back to a null selection when unset or stale.
  - `saveWorkspaceResearchSelection(selection, updatedById)` → validates provider exists/enabled/configured and the model is in the catalog with `toolCallingCapable: true`, then upserts `WorkspaceAiConfig`.
  - `resolveWorkspaceResearchModel(userId)` → returns `{ providerId, modelId, model: LanguageModel } | null`, resolving the key via `getProviderApiKey` and the adapter's `createLanguageModel`; returns `null` when unset or the provider is no longer available (never throws for unset config).
- **Why**: Central, testable ownership of the new role, mirroring `lib/knowledge/embedding-settings.ts` so the pattern stays consistent.
- **Affected files**: `ai/providers/research-settings.ts` (new), `ai/providers/service.ts` (only if a shared helper is needed).
- **Dependencies**: Steps 1–2.
- **Done when**: Unit tests cover get/save/resolve incl. invalid selection rejection and null fallback.

### Step 4 — Admin API route

- **What to do**: Create `app/(chat)/api/ai/workspace/route.ts`: `GET` returns `getWorkspaceAISettings()`; `PUT` parses `{ researchProviderId, researchModelId }` with Zod, calls `saveWorkspaceResearchSelection`, returns the saved settings; both admin-only (same `getAuthenticatedUser` + role check as `/api/ai/knowledge`).
- **Why**: The settings panel needs a server contract; admin-only enforcement prevents members from changing workspace research routing.
- **Affected files**: `app/(chat)/api/ai/workspace/route.ts` (new).
- **Dependencies**: Step 3.
- **Done when**: Manual curl of GET (admin vs member) and PUT (valid/invalid payloads) behaves like `/api/ai/knowledge`.

### Step 5 — Research & tool calling settings panel

- **What to do**: Build `components/settings/research-ai-settings.tsx` modeled on `KnowledgeAISettingsPanel`: provider select (options labeled "— setup required" when unconfigured), model select filtered to `toolCallingCapable`, description line, provider-not-ready warning, dirty-state save via `PUT /api/ai/workspace`, "last changed by" line. Wire it into `components/settings/ai-provider-settings.tsx` below the knowledge panel inside the "configuration" tab, and set the tab's `attention` dot when no research model is configured. Update `app/(admin)/settings/ai/page.tsx` to load `getWorkspaceAISettings()` alongside the existing promises.
- **Why**: Admins need the same first-class UX for the research role that embeddings already have.
- **Affected files**: `components/settings/research-ai-settings.tsx` (new), `components/settings/ai-provider-settings.tsx`, `app/(admin)/settings/ai/page.tsx`.
- **Dependencies**: Steps 3–4.
- **Done when**: In `/settings/ai` → AI configuration, the new panel renders, warns when the chosen provider is unavailable, and persists selection with toast feedback.

### Step 6 — Two-phase chat orchestration (spike then implement)

- **What to do**:
  1. Spike the streaming relay: confirm how to run phase 1 (`streamText` on the research model with the same `tools`, `stopWhen`, `prepareStep`) and relay its tool parts, then run phase 2 (`streamText` on the writer model with `messages` built from phase 1's `response.messages`) and relay its text parts, such that the client `useChat` renders one continuous assistant message with the live timeline intact. Fallback option if the relay is impractical: `generateText` for research + a static "Researching…" state, then stream the answer.
  2. In `stream-chat.ts`, resolve the writer via `resolveUserLanguageModel` (unchanged) and the research model via `resolveWorkspaceResearchModel`; when the research model is `null`, keep today's single-`streamText` path verbatim.
  3. When split: phase 1 passes `tools`, `stopWhen: stepCountIs(10)` (see open decision), the memory middleware wrap, and the knowledge preflight (which should use the research model for its internal rerank). Phase 2 builds the final system prompt from `companyAssistantSystemPrompt` + web research instructions + agent settings + the research transcript summary, and streams only text to the client.
  4. Keep `extractionModel` on the writer model; update `experimental_telemetry.functionId` to include both provider ids.
- **Why**: This is the core value — a cheap/fast research model can burn tool-calling steps, and the user's chosen (possibly premium) model only writes the final answer.
- **Affected files**: `ai/chat/stream-chat.ts`, possibly a small new `ai/chat/research-loop.ts` if the phase-1 logic grows.
- **Dependencies**: Steps 1–4.
- **Done when**: With a research model configured, tool calls visibly run under the research model and the answer text streams from the writer model; with none configured, behavior is byte-for-byte today's.

### Step 7 — Documentation

- **What to do**: Update `docs/ai-providers.md` to describe the three roles (embedding, research, chat), the new request flow (research loop → writer answer), and the fallback rule. Update `README.md` project structure and AI settings description.
- **Why**: The architecture doc currently states chat is single-model; leaving it stale would mislead every future agent and contributor.
- **Affected files**: `docs/ai-providers.md`, `README.md`.
- **Dependencies**: Steps 1–6 (docs reflect final contracts).
- **Done when**: Docs describe the roles, files, and fallback accurately.

### Step 8 — Validation and QA

- **What to do**: Run `pnpm typecheck`, `pnpm lint`, `pnpm test`, and a production build. Manual QA: configure a research provider (e.g. DeepSeek or Groq) while chatting with a different writer provider; verify the timeline, answer quality, fallback when the research provider is disabled, and admin vs member access on the new route.
- **Why**: The two-model pipeline and the streaming relay are the riskiest parts; end-to-end verification is required.
- **Affected files**: none (validation only).
- **Dependencies**: all prior steps.
- **Done when**: All commands green; QA checklist items pass.

## 7. Database Changes

- **New model `WorkspaceAiConfig`** (additive):

  | Field | Type | Notes |
  | --- | --- | --- |
  | `id` | `String @id @default("workspace") @db.VarChar(30)` | Singleton row, mirrors `KnowledgeAiConfig` |
  | `researchProviderId` | `String @db.VarChar(50)` | Provider id from the adapter registry or custom provider |
  | `researchModelId` | `String @db.VarChar(200)` | Model id from the provider's catalog |
  | `updatedById` | `String @db.Uuid` | FK → `User.id` |
  | `updatedAt` | `DateTime @updatedAt` | |

- **Relation**: `User.workspaceAiConfigs WorkspaceAiConfig[] @relation("WorkspaceAIConfigUpdater")`.
- **Migration strategy**: one additive migration creating only this table and its FK/index; no column changes, no data migration, no backfill. Rollback = drop the table.
- **Seed data**: none — unset means "fall back to the user's chat model".

## 8. Backend Changes

- `ai/providers/research-settings.ts` (new) — `getWorkspaceAISettings`, `saveWorkspaceResearchSelection`, `resolveWorkspaceResearchModel` as described in Step 3.
- `ai/chat/stream-chat.ts` — resolve two models; split the loop into a research phase (tools, evidence) and an answer phase (writer, streamed text); keep the single-model fallback path.
- `app/(chat)/api/ai/workspace/route.ts` (new) — admin-only GET/PUT for the research selection.
- `ai/providers/*.ts` adapters — populate `toolCallingCapable` on each catalog model.
- No changes to `getProviderApiKey`, crypto, model cache, or credential handling — the research model reuses existing per-provider key resolution.

## 9. Frontend Changes

- `components/settings/research-ai-settings.tsx` (new) — workspace research-model panel (provider + tool-calling-capable model selects, save, warnings), modeled on `KnowledgeAISettingsPanel`.
- `components/settings/ai-provider-settings.tsx` — render the panel in the configuration tab; `attention` dot when research model unset.
- `app/(admin)/settings/ai/page.tsx` — pass `initialResearchSettings` into `AIProviderSettings`.
- No changes to the chat composer's `ModelSelector` — the user's "selected AI" for answering is unchanged.

## 10. Validation Rules

- Research provider must exist, be configured, and be enabled; otherwise `saveWorkspaceResearchSelection` rejects with a provider-specific message (mirroring `saveKnowledgeAISelection`).
- Research model must be present in the provider's current catalog and have `toolCallingCapable: true`.
- `PUT /api/ai/workspace` validates `researchProviderId` (≤50 chars) and `researchModelId` (1–200 chars) with Zod; 400 with a joined message on failure.
- `resolveWorkspaceResearchModel` must **never** throw when config is unset or stale — it returns `null` and the chat path falls back to the writer model.
- Stale selections (provider disabled/deleted after save) resolve to `null` and are surfaced as "setup required" in the panel, not as hard errors.
- Admin-only guard on the route: non-admin gets 403 (same as `/api/ai/knowledge`).

## 11. Security Considerations

- No new secrets or credential storage: the research model uses the same `getProviderApiKey` path (AES-256-GCM site keys or environment fallback) as chat today.
- Admin-only configuration: members cannot change workspace research routing or read the config beyond what the shared catalog already exposes.
- The research transcript is passed into the writer model's context; this is the same class of data already surfaced as visible evidence/tool parts, so no new data-exposure surface.
- Keep `experimental_telemetry` function ids provider-qualified so per-provider cost/usage remains attributable.
- Custom providers: their models default to `toolCallingCapable: true`; admin-created custom providers are admin-controlled by definition, consistent with existing behavior.

## 12. Testing Plan

- **Unit tests**
  - `tests/unit/ai/providers.test.ts` — `toolCallingCapable` flags on adapter model lists; custom-provider default true.
  - `tests/unit/ai/research-settings.test.ts` (new) — get with unset/stale selection, save validation (unknown provider, disabled provider, non-tool-calling model), resolve returning a model vs `null` fallback.
- **Integration tests**
  - `stream-chat.ts` orchestration: with research model configured (tools driven by research model, answer from writer), and without (exact current behavior).
- **E2E / manual QA**
  - `/settings/ai` — configure research model; attention dot appears/disappears; member gets 403 on the workspace route.
  - Chat — send a knowledge + web research question with a distinct research provider; verify the live timeline, citation format, and that the final prose style comes from the writer model.
  - Disable the research provider → next chat request silently falls back to the writer-only path.
- **Regression**: `pnpm test` full suite, `pnpm typecheck`, `pnpm lint`, `pnpm build`.

## 13. Rollback Plan

- **Feature flag**: gate the split orchestration behind an env/feature flag (e.g. `AI_RESEARCH_MODEL_ENABLED` default off until QA passes). With the flag off, `stream-chat.ts` takes today's single-model path and the rest is inert config surface.
- **Database**: the migration is purely additive; rollback is `prisma migrate` down (drops `WorkspaceAiConfig`) with zero impact on existing tables. No data migration exists to reverse.
- **API/UI**: the new route and panel can be removed independently; the settings page degrades to today's two-tab layout.
- **Order**: disable the flag first (restores runtime behavior), then remove UI/route, then drop the table.

## 14. Final Checklist

- [x] `AIProviderModel.toolCallingCapable` added and populated across all adapters + custom providers.
- [x] `WorkspaceAiConfig` model and additive migration applied.
- [x] `ai/providers/research-settings.ts` with get/save/resolve + null fallback.
- [x] `app/(chat)/api/ai/workspace/route.ts` admin GET/PUT with validation.
- [x] Research panel in `/settings/ai` configuration tab with attention indicator.
- [x] `stream-chat.ts` two-phase orchestration behind an emergency-disable flag; single-model fallback verified.
- [x] Live tool/source activity preserved while research narrative stays hidden (integration-tested with distinct mock providers).
- [x] `docs/ai-providers.md` + `README.md` updated to the three-role model.
- [x] Unit + integration tests added and passing (34 files, 157 tests).
- [x] `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` green.
- [x] Runtime QA: production server auth boundaries, real database migration status, live configured-provider discovery, split writer/research stream, and fallback path verified.
