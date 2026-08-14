# AI Provider Roles — Dedicated Research Model for Tool Calling

> **For Hermes:** Canonical plan lives at `plans/ai-provider-roles/PLAN.md`. Read it
> before implementing; this file is a bridge so Hermes discovers the work. Use the
> subagent-driven-development skill to implement task-by-task.

**Goal:** Let administrators assign a dedicated, workspace-wide **research model** that
runs all tool calling and evidence gathering, while the user-selected **chat model**
writes the final answer. Completes the provider-role model beside the existing
embedding role.

**Why now:** Today `ai/chat/stream-chat.ts` uses ONE model for everything — tool calls,
knowledge preflight rerank, memory extraction, and the answer. The embedding role is
already a separate workspace config (`KnowledgeAiConfig` + `lib/knowledge/embedding-settings.ts`).
This plan mirrors that pattern for research/tool calling.

**Architecture (two phases):**
1. **Research phase** — the workspace research model drives the existing tools
   (knowledge search/read, web search/read/browse, memory) with `streamText` +
   `stepCountIs(10)`, collecting evidence and streaming tool parts live.
2. **Answer phase** — the user-selected chat model (`resolveUserLanguageModel`)
   streams the final answer with the research transcript as context.
3. **Fallback** — no research model configured → today's single-model path, unchanged.

**Key pieces:**
- `AIProviderModel.toolCallingCapable` flag across all adapters + custom providers.
- New additive `WorkspaceAiConfig` table (researchProviderId/researchModelId/updatedById).
- `ai/providers/research-settings.ts` mirroring `lib/knowledge/embedding-settings.ts`.
- Admin route `app/(chat)/api/ai/workspace/route.ts` (GET/PUT, mirrors `/api/ai/knowledge`).
- Research panel in the `/settings/ai` configuration tab.
- Two-phase orchestration in `stream-chat.ts` behind a feature flag.

**Sequencing:** types/migration → config service → route → settings panel → chat
orchestration spike (streaming relay of research tool parts, then writer text) →
docs → full validation (`pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`).

**Constraints:** additive-only DB changes; chat must never hard-fail on research
config (silent fallback); keep the live tool-activity timeline during research.

**Open decisions:** streaming UX during research (relay live vs static "Researching…");
step-budget split (10/4); exact capability flag name. See canonical plan for details.
