# Workspace Answer Processor and Humanizer Flow

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
> - [x] Backend changes implemented
> - [x] Frontend changes implemented
> - [x] Tests passing
> - [x] Security reviewed
> - [ ] Deployed

## 1. Goal

Remove provider/model choice from the chat composer and replace it with a read-only workspace thinking-provider indicator plus a functional Humanizer toggle that routes the visible final answer through an administrator-selected end-processor model.

## 2. Context Summary

### Confirmed repository facts

- `MultimodalInput` currently renders a `ModelSelector`, a Think toggle, and a Quick/Deep research toggle.
- The Think toggle is client-only state and is not included in `/api/chat` requests, so it currently has no runtime effect.
- The newly implemented research role runs tools and passes evidence to a user/agent-selected writer model.
- `WorkspaceAiConfig` currently stores only required research provider/model fields.
- `/api/ai/workspace` is admin-only and the existing research settings panel already owns workspace role selection.
- Provider keys and model resolution are already centralized and can resolve a second workspace model without new credential storage.

### Assumptions for this plan

- “Thinking is Google” means the composer displays the configured research provider (Google once selected) as read-only status; it is not a user-editable control.
- “End processor” and “Humanizer” are the same final tool-free pass: when enabled, the workspace humanizer model writes the visible answer from the research transcript.
- Humanizer is enabled by default per open chat, may be toggled per request, and is not persisted to the database in v1.
- When Humanizer is off or its model is unavailable, the configured thinking/research model writes the visible answer in a separate tool-free pass.
- Existing user and agent model-selection data/API remain for backwards compatibility but are no longer shown or used by normal chat orchestration.
- If no workspace thinking model is configured, the hidden legacy user/agent model resolution remains an emergency compatibility fallback so chat does not become unavailable.

### Open decisions resolved for implementation

- [x] Humanizer defaults on.
- [x] The composer shows a provider-neutral `Thinking` status; provider and model details remain hidden from chat users.
- [x] Humanizer model is workspace-wide and administrator-selected.
- [x] Quick/Deep remains a separate research-depth control.

## 3. Scope

- Add optional workspace humanizer/end-processor provider and model fields.
- Extend workspace AI settings read/save/resolve contracts for both thinking and humanizer roles.
- Add an authenticated, non-secret runtime-status endpoint for the composer.
- Remove `ModelSelector` from `Chat` and `MultimodalInput`.
- Replace Think with a read-only thinking-provider pill and add a functional Humanizer toggle.
- Send `humanizerEnabled` with chat requests and select the final-pass model accordingly.
- Keep the research/tool timeline and single assistant message behavior.
- Update tests, docs, and plans index.

## 4. Out of Scope

- Dropping `UserAiSelection` or agent provider/model columns.
- Removing the legacy selection API.
- Per-user humanizer-model selection or persistence.
- Adding more answer-processing stages.
- Changing tools, knowledge embeddings, or research-depth semantics.

## 5. Affected Files and Folders

```txt
plans/
+ answer-humanizer-flow/PLAN.md
AGENTS.md
prisma/
~ schema.prisma
+ migrations/*_workspace_humanizer_model/migration.sql
ai/providers/
~ research-settings.ts
ai/chat/
~ stream-chat.ts
app/(chat)/api/
~ chat/route.ts
+ ai/runtime/route.ts
~ ai/workspace/route.ts
components/custom/
~ chat.tsx
~ multimodal-input.tsx
components/settings/
~ research-ai-settings.tsx
docs/
~ ai-providers.md
README.md
tests/unit/ai/
~ research-settings.test.ts
~ provider-role-orchestration.test.ts
~ workspace-route.test.ts
+ runtime-route.test.ts
```

**Important path notes**

- The database change is additive and nullable, so existing workspace configuration remains valid.
- The runtime endpoint exposes only availability and provider labels—never model IDs, keys, or admin metadata.
- The composer keeps the existing visual language; the signature element is a small connected flow control: `Thinking: Google → Humanizer`.

## 6. Step-by-Step Implementation Plan

1. **Extend workspace configuration** — add nullable humanizer provider/model columns and migration. **Why:** persist the end processor without invalidating existing rows. **Files:** Prisma schema/migration. **Dependencies:** none.
2. **Expand workspace role service** — expose humanizer selection, validate and save both roles, resolve humanizer with null fallback, and expose safe runtime status. **Why:** keep role ownership centralized. **Files:** `ai/providers/research-settings.ts`. **Dependencies:** Step 1.
3. **Update APIs** — accept both role selections in the admin route and create authenticated runtime status GET. **Why:** settings need writes and composer needs safe labels. **Files:** workspace/runtime routes. **Dependencies:** Step 2.
4. **Implement final-pass routing** — accept `humanizerEnabled`; research model runs tools, then either humanizer or thinking model writes the final answer. Preserve legacy fallback only when no thinking role is configured. **Why:** make the toggle real. **Files:** chat route and orchestration. **Dependencies:** Steps 1–3.
5. **Reshape composer controls** — remove `ModelSelector`, load runtime status, render thinking provider as read-only, and send Humanizer state. **Why:** users control behavior, not infrastructure. **Files:** chat and multimodal input. **Dependencies:** Steps 3–4.
6. **Expand admin UI** — add humanizer provider/model controls to the workspace role panel and update flow copy. **Why:** administrators must control the hidden models. **Files:** research settings panel. **Dependencies:** Steps 2–3.
7. **Test and document** — cover migration contracts, role validation/fallback, toggle routing, endpoint security, composer contract, full regression commands, and runtime smoke. **Why:** verify the architecture through multiple paths. **Files:** tests/docs. **Dependencies:** all previous steps.

## 7. Database Changes

- Add nullable `humanizerProviderId String? @db.VarChar(50)` and `humanizerModelId String? @db.VarChar(200)` to `WorkspaceAiConfig`.
- Migration uses two `ADD COLUMN` statements only; no backfill or destructive changes.
- Null means Humanizer falls back to the thinking model.

## 8. Backend Changes

- Workspace settings return `thinkingSelection` and `humanizerSelection`.
- Admin save validates thinking model tool capability and humanizer model chat capability.
- Runtime status returns `{ available, thinkingProviderLabel, humanizerAvailable }`.
- `/api/chat` validates optional `humanizerEnabled` and passes it to orchestration.
- The final pass is always tool-free; Humanizer does not gain access to private tools directly.

## 9. Frontend Changes

- Composer control order: read-only `Thinking: <provider>` pill, Humanizer toggle, Quick/Deep toggle, spacer, existing action buttons.
- Humanizer defaults active and uses a Wand icon with concise accessible copy.
- Loading/unavailable states explain that workspace AI must be configured without offering provider/model selection.
- Admin workspace panel shows two linked role selectors: Thinking and Humanizer.

## 10. Validation Rules

- Thinking provider/model are required on admin save and must be enabled, configured, accessible, and tool-capable.
- Humanizer provider/model must be supplied together or both omitted; the selected model must be accessible and chat-capable.
- Runtime status never throws for stale configuration; it reports fallback availability.
- Humanizer request value must be boolean when supplied and defaults to true.

## 11. Security Considerations

- Admin-only role mutation remains enforced server-side.
- Runtime status requires authentication and exposes labels/booleans only.
- Humanizer receives the same research transcript already used for final writing and gets no tools.
- No new credentials or secret-bearing responses are introduced.

## 12. Testing Plan

- Unit: workspace settings save/resolve, missing/stale humanizer fallback, request validation.
- Integration: distinct thinking and humanizer mock models; toggle on/off; hidden legacy fallback.
- Route: runtime authentication and admin workspace mutation.
- Regression: full tests, lint, typecheck, production build, migration status.
- Manual/runtime QA: production server HTTP probes and rendered composer at desktop/mobile widths.

## 13. Rollback Plan

- Disable Humanizer behavior in the composer/orchestration while leaving nullable columns inert.
- Revert UI/API code independently; existing research role continues working.
- The additive nullable columns may remain safely if application rollback is required.

## 14. Final Checklist

- [x] Nullable humanizer fields and migration applied.
- [x] Workspace role service supports Thinking + Humanizer with Google as the unset default.
- [x] Admin and runtime APIs implemented and secured.
- [x] Humanizer toggle controls the actual final-pass model and prompt.
- [x] Composer contains no provider/model selector.
- [x] Thinking readiness is shown read-only without exposing provider/model text.
- [x] Admin panel configures both roles.
- [x] Unit, integration, route, and runtime checks pass (35 files, 166 tests; desktop and 390px rendered QA).
- [x] Docs and plan status updated.
