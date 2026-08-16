# Skill Style Precedence and Retrieval Gating

> **Status**: [x] Planning | [ ] In Progress | [ ] Implemented | [ ] Archived
>
> **Created**: 2026-08-16
>
> **Quick Checklist**:
> - [x] Requirements gathered
> - [x] Codebase analyzed
> - [ ] Phase 1: Skills override agent style for the turn
> - [ ] Phase 2: Knowledge-need classifier gates the preflight
> - [ ] Phase 3: Preflight telemetry hygiene + calibrated miss framing
> - [ ] Tests passing
> - [ ] Deployed

## 1. Goal

Two chat-orchestration fixes:

1. **Skill/profile conflict** — an active chat skill must fully define the
   turn's response style and structure, overriding the agent profile's mood,
   answer length, response layers, and behavior preferences. Today the two
   blocks are concatenated with no precedence between them, so the model
   resolves the conflict arbitrarily.
2. **Retrieval appropriateness** — the notebook preflight currently runs for
   every message (greetings included), paying an embedding call, an LLM
   rerank, a `KnowledgeQueryLog` write, and a rate-limit count, then injecting
   "state that the answer was not found" framing into non-company turns. A
   lightweight classifier should skip the preflight for turns that clearly do
   not need company knowledge.

## 2. Design

- **Precedence is prompt-level**: when a skill is applied, the agent-profile
  block keeps identity but suspends style directives, and the skill wrapper
  states it overrides profile style (never safety, privacy, source-authority,
  or citation rules). No schema or API change.
- **The gate fails open**: the classifier is one small structured call on the
  already-resolved research model with a short timeout. Any error, timeout, or
  ambiguity defaults to running the preflight — a false negative costs one
  search; a false positive costs the whole polluted path. Deep research mode
  bypasses the gate (explicit research intent).
- **Tools remain available regardless**: the base contract still instructs
  notebook-first for work questions, so a mis-gated turn recovers by calling
  `searchCompanyKnowledge` itself (which logs telemetry and is rate-limited).
- **Preflight stops writing telemetry**: preflight queries are skipped in
  `KnowledgeQueryLog` (and skip the rate-limit assert), so the gaps dashboard
  reflects deliberate information needs, not every keystroke greeting.
  Deliberate tool searches keep logging; feedback attribution is unchanged.
- **Zero-hit framing is calibrated**: the injected miss instruction only
  demands "not found in approved company knowledge" phrasing for
  company-related questions; general requests answer normally.

## 3. File plan

| File | Change |
| --- | --- |
| `lib/agent-settings.ts` | `formatAgentSettingsForPrompt` gains `{ styleOverriddenBySkill }` |
| `lib/skills.ts` | Skill wrapper states turn-level precedence over profile style |
| `ai/chat/retrieval-gate.ts` | New `shouldUseCompanyKnowledge` classifier (fail-open) |
| `ai/chat/stream-chat.ts` | Wire gate before preflight; pass override flag; calibrated miss text |
| `lib/knowledge/retrieval.ts` | `persistTelemetry` option skips log write + rate-limit assert |
| `tests/unit/agent-settings.test.ts` | Override-mode formatting cases |
| `tests/unit/skills.test.ts` | Precedence-line assertions |
| `tests/unit/ai/retrieval-gate.test.ts` | Fail-open behavior with stubbed models |
| `AGENTS.md` | Plan table entry |

## 4. Risks and mitigations

- **Classifier misjudges a company question as general** — tools stay
  available and the base contract mandates search-first for work topics; the
  model recovers in-band.
- **Added latency on knowledge turns** — one small call (~64 output tokens,
  5s timeout) before a preflight that already pays embedding + rerank; net
  faster on gated turns.
- **`queryLogId` becomes nullable** — only the preflight path returns `null`;
  the tool path (used for feedback attribution) always logs.
- **Skills could try to override safety via wording** — the existing escape +
  precedence clauses still rank skills below safety/privacy/source rules.

## 5. Out of scope

- Persisting per-skill default depth/humanizer settings.
- Classifier caching across turns.
- Embedding-model changes for the preflight path.
