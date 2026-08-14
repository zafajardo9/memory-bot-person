# Chat Thinking and Message Queue

> **Status**: [ ] Planning | [ ] In Progress | [x] Implemented | [ ] Archived
>
> **Created**: 2026-08-14
>
> **Implemented**: 2026-08-14
>
> **Quick Checklist**:
> - [x] Requirements gathered
> - [x] Codebase analyzed
> - [x] Database changes reviewed
> - [x] Backend changes implemented (not required)
> - [x] Frontend changes implemented
> - [x] Tests passing
> - [x] Security reviewed
> - [ ] Deployed

## 1. Goal

Make the chatbot's thinking phase quieter and easier to scan while allowing one message to be visibly queued and sent automatically after the current answer completes.

## 2. Context Summary

### Confirmed repository facts

- `AssistantActivity` renders reasoning, tool work, sources, and the active composing state.
- The current activity trace uses vertical connector lines, bordered status nodes, and multiple spinners.
- `MultimodalInput` remains visible during generation, but Enter is rejected and the send button is replaced by Stop.
- `Chat` owns AI SDK status, message submission, draft text, and attachment state.
- No database or backend contract is needed for an in-memory per-chat queue.

### Assumptions for this plan

- “Loading circles” means a calm three-dot animated processing indicator in the active assistant trace.
- One queued message is sufficient; another draft may be typed while it waits, but it cannot replace or send ahead of the queued message.
- The queued message is session-local and sends automatically after the current response reaches an idle state.
- Queued attachments are supported if they were already attached before generation began; new uploads remain unavailable during generation.

### Open decisions to resolve before implementation

- None; the behavior is bounded and reversible in client state.

## 3. Scope

- Remove activity timeline connector lines and reduce decorative border/background opacity.
- Add a three-circle processing indicator with reduced-motion behavior.
- Keep the composer textarea editable while an answer is being generated.
- Queue one submitted message during generation and show its saved state in the composer.
- Automatically send the queued message after generation completes.
- Allow the queued message to be removed before it sends.
- Add focused tests for queue-state behavior and retain existing activity-label tests.

## 4. Out of Scope

- Persistent queues across reloads or browser sessions.
- Multiple queued messages, queue reordering, or editing an already queued item.
- Backend, database, provider, or orchestration changes.
- Enabling file uploads while an answer is actively generating.

## 5. Affected Files and Folders

```txt
AGENTS.md
plans/
+ chat-thinking-queue/PLAN.md
components/custom/
~ assistant-activity.tsx
~ chat.tsx
~ multimodal-input.tsx
tests/unit/ai/
~ assistant-activity.test.ts
```

**Important path notes**

- `chat.tsx` owns the queue because it can observe the complete request lifecycle.
- `multimodal-input.tsx` owns the visible queued state, editable draft, and send/queue affordance.
- `assistant-activity.tsx` owns both the quieter work trace and the shared processing indicator.

## 6. Step-by-Step Implementation Plan

1. **Define queue behavior** — add a small exported submission-state helper and one queued-message state in `Chat`. **Why:** centralize the ready/queue/blocked decision and make it testable. **Files:** `components/custom/chat.tsx`. **Dependencies:** none.
2. **Wire automatic dispatch** — enqueue during active generation, clear and send once idle, retain the item when a chat error is present, and expose cancellation. **Why:** provide predictable FIFO-like behavior for the single supported queue slot. **Files:** `components/custom/chat.tsx`. **Dependencies:** Step 1.
3. **Update the composer** — keep the textarea enabled, make Enter and the arrow button queue while busy, retain Stop as a separate action, and render a concise queued-message preview. **Why:** users need to understand both what is processing and what will happen next. **Files:** `components/custom/multimodal-input.tsx`. **Dependencies:** Steps 1–2.
4. **Restyle assistant activity** — remove timeline rules, soften supporting elements, and replace active spinners in the primary status with a three-dot processing signature. **Why:** lower visual noise while preserving meaningful progress. **Files:** `components/custom/assistant-activity.tsx`. **Dependencies:** none.
5. **Validate behavior and visuals** — extend unit coverage, run lint/typecheck/tests, and inspect desktop/mobile rendering when a local app session is available. **Why:** protect lifecycle behavior, accessibility, and responsive layout. **Files:** `tests/unit/ai/assistant-activity.test.ts`. **Dependencies:** Steps 1–4.

## 7. Database Changes

- None.

## 8. Backend Changes

- None. The queue is intentionally client-local and uses the existing chat request contract.

## 9. Frontend Changes

- Add one optional queued message to `Chat` and dispatch it after status becomes idle.
- Keep draft input enabled while `submitted` or `streaming`.
- Show separate Stop and Queue controls during active generation.
- Display a removable queued-message strip above the draft.
- Simplify activity rows into low-opacity, line-free entries.
- Use three small staggered circles for active processing, with animations disabled under reduced motion.

## 10. Validation Rules

- Blank drafts and incomplete uploads cannot be queued.
- Only one message may be queued at a time.
- A queued message is not sent while the current request is active or has an unresolved error.
- Removing the queued message prevents automatic dispatch.
- The AI-unavailable state continues to disable the composer.

## 11. Security Considerations

- No new trust boundary, persistence, credential access, or server input is introduced.
- Queued text and attachment metadata remain in existing client memory until submitted or removed.

## 12. Testing Plan

- Unit: submission state is `send`, `queue`, or `blocked` for idle, generating, and occupied-queue states.
- Regression: existing assistant activity labels and tool descriptions continue to pass.
- Static checks: ESLint and TypeScript.
- Full suite: Vitest.
- Manual QA: desktop and narrow mobile, Enter/Shift+Enter, queue/cancel/auto-send, Stop, error retention, reduced motion, light/dark themes.

## 13. Rollback Plan

- Revert the three chat component changes; no data migration or cleanup is required.
- The plan file may remain archived as implementation history.

## 14. Final Checklist

- [x] Requirements and current lifecycle reviewed.
- [x] No database/backend changes required.
- [x] Single-message queue implemented.
- [x] Editable-during-generation composer implemented.
- [x] Queued state and cancellation implemented.
- [x] Thinking activity visually simplified.
- [x] Processing circles and reduced-motion behavior implemented.
- [x] Unit tests, lint, typecheck, full test suite, and production build pass (35 files, 169 tests).
- [ ] Desktop/mobile authenticated visual QA complete (local browser reached `/login`; no authenticated session was available).
- [x] Plan marked implemented.
