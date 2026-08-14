# AGENTS.md — Project instructions for AI agents

This file is read by Zed, Claude Code, Cursor, and other agents that work in this
repository. Keep it short: it exists to point agents at the real sources of truth.

## Where plans live

**Plans are the source of truth for intended work.** Every feature, refactor, or
architecture change must be documented under `plans/` as `plans/<plan-name>/PLAN.md`
before implementation (see the `project-planning` skill). Always check `plans/`
first — a requested change may already be planned. Update the plan's checklist as
work progresses instead of improvising around it.

### Active plans

| Plan | Status | Summary |
| --- | --- | --- |
| [`plans/answer-humanizer-flow/PLAN.md`](plans/answer-humanizer-flow/PLAN.md) | Implemented | Removes provider/model selection from chat; adds read-only Thinking-provider status and an optional workspace end-processor Humanizer pass. |
| [`plans/ai-provider-roles/PLAN.md`](plans/ai-provider-roles/PLAN.md) | Implemented | Dedicated workspace-wide research model for tool calling. Its user-selected writer behavior was later superseded by `answer-humanizer-flow`. |
| [`plans/ai-settings-redesign/PLAN.md`](plans/ai-settings-redesign/PLAN.md) | Implemented | Redesigns `/settings/ai` as a responsive AI control room with clearer provider management and workspace role flow. |
| [`plans/company-knowledge-base/PLAN.md`](plans/company-knowledge-base/PLAN.md) | Planning | Company knowledge base with grounded AI tool calling. |
| [`plans/framework-upgrade/PLAN.md`](plans/framework-upgrade/PLAN.md) | Planning | Framework, technology, and dependency upgrade. |
| [`plans/sustainable-memory-context/PLAN.md`](plans/sustainable-memory-context/PLAN.md) | Planning | Sustainable memory, context, and knowledge implementation. |
| [`plans/toolkit-expansion-user-memory/PLAN.md`](plans/toolkit-expansion-user-memory/PLAN.md) | Planning | Toolkit expansion and persistent user memory. |

When a new plan is created, add it to this table.

## Architecture notes (read these before changing behavior)

- **AI provider roles**: workspace Thinking/tool calling, optional Humanizer/end
  processing, and knowledge embeddings are separate concerns. See
  `docs/ai-providers.md`, `plans/ai-provider-roles/PLAN.md`, and
  `plans/answer-humanizer-flow/PLAN.md`. Never couple the embedding provider to
  a language-model role.
- **Chat orchestration** lives in `ai/chat/stream-chat.ts`; provider adapters,
  credentials, and the model catalog live in `ai/providers/`.
- **Additive-only database changes**: the codebase's prior plans constrain schema
  work to new tables/columns — no drops, no required columns, no data loss.

## Skills

Skills for agents are installed under `.agents/skills/` (Zed), `.claude/skills/`
(Claude Code), and `agent/skills/` (the `agent` CLI). `project-planning` governs
how plans are written. See `skills-lock.json` for pinned skill versions.
