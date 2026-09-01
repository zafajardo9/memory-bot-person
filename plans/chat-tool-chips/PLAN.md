# Chat Tool Chips Integration

> **Status**: [x] Planning | [ ] In Progress | [x] Implemented | [ ] Archived
>
> **Created**: 2026-09-01
>
> **Implemented**: 2026-09-01
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

Render the chatbot's live thinking and tool-calling trace through the BeautifUI `ToolChips` primitive and foundation tokens while preserving every existing tool state, rich result, accessibility behavior, and responsive chat interaction.

## 2. Context Summary

### Confirmed repository facts

- `components/custom/message.tsx` collects AI SDK reasoning, tool, and source parts and passes them to `AssistantActivity`.
- `components/custom/assistant-activity.tsx` currently owns a separate disclosure UI for reasoning, tool state, elapsed time, source counts, errors, and specialized outputs.
- `components/primitives/ToolChips.tsx` exists as a client component, but its current defaults are gallery data with timed row reveal, file-diff examples, fixed minimum height, and no live AI SDK adapter.
- `app/beautifui/foundation.css` contains the tokens, radii, shadows, and keyframes consumed by `ToolChips`; it is not currently loaded by the application.
- The app already has its own Tailwind theme in `app/globals.css`, so the foundation must be integrated without replacing existing global color and body rules.
- Vitest unit coverage for presentation and input mapping lives in `tests/unit/ai/assistant-activity.test.ts`.
- No server, API, database, or persisted message contract change is required.

### Assumptions for this plan

- “Use the ToolChips API” means the live assistant trace should render the primitive itself, not merely copy its visual styles.
- Rich interactive tool outputs should remain available inside each expandable chip row.
- The trace should stay open while work is active and remain user-collapsible after completion.
- Gallery defaults may remain supported, but production callers need deterministic rendering with no fake timed reveal or placeholder diffs.

### Open decisions to resolve before implementation

- None. Existing application behavior provides sufficient acceptance criteria, and implementation can remain backward-compatible with the primitive's gallery defaults.

### Implementation notes (2026-09-01)

- `AssistantActivity` now preserves the original AI SDK message-part order and adapts reasoning plus static/dynamic tool parts into stable `ToolStep` records.
- The production caller disables gallery timing/diffs, while the primitive keeps those defaults for its existing showcase use.
- Specialized knowledge, web, weather, flight, memory, generic, denied, and error output behavior remains available through expandable row details.
- `foundation.css` is loaded before Tailwind and places its selectors in a dedicated low-priority `beautifui` cascade layer. Its `@theme` utilities remain available without overriding Kairo's later `base` layer.
- Verified with 209/209 Vitest tests, direct TypeScript checking, focused ESLint, `git diff --check`, and a successful Next.js production build.
- Browser QA against the production build confirmed the public app shell retains its existing theme. The chat route requires authentication, so no credentialed live tool call was performed.

## 3. Scope

- Extend `ToolChips` with stable row identifiers, optional rich detail content, deterministic rendering, configurable initial openness, and optional active/error/done status semantics.
- Convert reasoning parts and all AI SDK static/dynamic tool parts into `ToolChips` steps.
- Preserve specialized web, knowledge, weather, flight, memory, approval, denied, and error presentations.
- Retain source aggregation, elapsed time, live progress, and accessible disclosure labels.
- Load BeautifUI foundation styles through an isolated cascade layer compatible with the current app theme.
- Add focused unit coverage for trace-to-chip mapping and dynamic header copy.

## 4. Out of Scope

- Changes to tool execution, model orchestration, prompts, or AI provider selection.
- Database or message-schema changes.
- Redesigning answer markdown, citations, composer controls, or settings pages.
- Introducing file-diff summaries when the chat tool output does not supply real diff metadata.
- Replacing the application's existing global visual identity with the full BeautifUI gallery theme.

## 5. Affected Files and Folders

```txt
~ AGENTS.md
~ app/
    globals.css
    beautifui/
      foundation.css
~ components/
    custom/
      assistant-activity.tsx
    primitives/
      ToolChips.tsx
~ tests/
    unit/
      ai/
        assistant-activity.test.ts
+ plans/
    chat-tool-chips/
      PLAN.md
```

### Important path notes

- `ToolChips.tsx` remains the reusable visual API; chat-specific AI SDK knowledge stays in `assistant-activity.tsx`.
- `foundation.css` supplies only the design foundation consumed by the primitive and is imported through `globals.css` with lower cascade priority than the app theme.
- `assistant-activity.test.ts` covers pure mapping behavior without requiring a browser DOM.

## 6. Step-by-Step Implementation Plan

1. **Harden the `ToolChips` production API**
   - **What to do**: Add stable step ids, status metadata, rich detail content, deterministic/progressive modes, controlled initial disclosure behavior, and empty-diff handling while preserving gallery defaults.
   - **Why**: Live AI parts update in place and may repeat labels; the primitive cannot depend on demo timers or text-only details.
   - **Affected files**: `components/primitives/ToolChips.tsx`
   - **Dependencies**: None.
   - **Done when**: A caller can render live rows immediately, expand rich output, and omit demo diffs and “more” affordances.

2. **Integrate the BeautifUI foundation safely**
   - **What to do**: Make the foundation importable from the existing Tailwind entry point and load it in an explicit low-priority cascade layer.
   - **Why**: `ToolChips` relies on foundation token utilities and motion keyframes, but the application theme must retain precedence.
   - **Affected files**: `app/beautifui/foundation.css`, `app/globals.css`
   - **Dependencies**: Step 1.
   - **Done when**: Tailwind generates the primitive utilities, the build resolves all imports, and existing app theme variables remain authoritative.

3. **Map AI reasoning and tool state to chips**
   - **What to do**: Add pure adapters for reasoning/tool labels, chips, detail lines, statuses, icons, error text, and aggregate header text; render `ToolChips` from `AssistantActivity`.
   - **Why**: The chat renderer should own domain mapping while the primitive remains reusable.
   - **Affected files**: `components/custom/assistant-activity.tsx`
   - **Dependencies**: Steps 1–2.
   - **Done when**: Streaming and completed traces use `ToolChips` for reasoning and every tool call.

4. **Preserve rich output and source behavior**
   - **What to do**: Mount existing specialized result components inside expandable chip details and retain the source links/count summary outside the row list where appropriate.
   - **Why**: A visual migration must not remove actionable approvals, evidence, weather, travel, or error details.
   - **Affected files**: `components/custom/assistant-activity.tsx`, `components/primitives/ToolChips.tsx`
   - **Dependencies**: Step 3.
   - **Done when**: Existing specialized outputs and accessibility labels remain reachable.

5. **Add regression coverage and validate**
   - **What to do**: Expand unit tests for tool state mapping, reasoning mapping, repeated rows, and summary labels; run focused tests, typecheck, lint, and build as feasible.
   - **Why**: Streaming unions and Tailwind integration are both sensitive to type and build regressions.
   - **Affected files**: `tests/unit/ai/assistant-activity.test.ts`
   - **Dependencies**: Steps 1–4.
   - **Done when**: Focused tests and static validation pass, with any unrelated pre-existing failures documented.

6. **Close out the plan**
   - **What to do**: Mark implementation and review checklists complete, add implementation notes, and record validation results.
   - **Why**: Repository plans are the source of truth for intended and completed work.
   - **Affected files**: `plans/chat-tool-chips/PLAN.md`, `AGENTS.md`
   - **Dependencies**: Step 5.
   - **Done when**: The plan accurately reflects the delivered state.

## 7. Database Changes

None. The integration consumes existing client-side `UIMessage` parts and introduces no schema, migration, index, or seed changes.

## 8. Backend Changes

None. Tool definitions, execution rounds, stream protocol, message persistence, and API routes remain unchanged.

## 9. Frontend Changes

- `ToolChips` becomes suitable for both its gallery example and deterministic live data.
- `AssistantActivity` becomes the adapter from AI SDK parts to primitive steps.
- Reasoning and tool details share one compact, expandable run trace.
- Existing specialized result components remain rendered inside their corresponding tool row.
- The foundation design tokens and animations become available without taking over the broader chat theme.

## 10. Validation Rules

- Empty reasoning text must still show a meaningful live thinking state.
- Repeated calls to the same tool must have unique keys based on `toolCallId`.
- Unknown tools must receive a readable fallback label and generic detail output.
- Approval, denial, output error, and streaming states must remain distinct.
- Empty diffs must not render placeholder file chips or a nonfunctional “more” button.
- Reduced-motion preferences must suppress reveal animations.

## 11. Security Considerations

- Tool outputs continue through React rendering rather than raw HTML injection.
- External links retain `target="_blank"` with `rel="noreferrer"`.
- Reasoning/tool visibility changes only presentation; it does not expose server-only chain-of-thought beyond reasoning text already present in the client stream.
- No new credentials, permissions, network calls, or user-controlled CSS are introduced.

## 12. Testing Plan

- **Unit tests**: Verify labels, input descriptions, state-to-status mapping, chip-step construction, and aggregate header copy.
- **Integration checks**: Typecheck the AI SDK discriminated unions and build the Tailwind CSS entry point.
- **E2E checks**: Exercise an active chat response with reasoning, web/knowledge tools, an unknown tool, a failed tool, and a completed trace when a runnable local environment is available.
- **Manual QA checklist**:
  - Expand/collapse the whole run and individual rows.
  - Confirm live rows appear immediately without demo delay.
  - Confirm duplicate tool names render separately.
  - Inspect light/dark mode and narrow mobile width.
  - Confirm keyboard focus and disclosure semantics.
  - Confirm rich result components still work.

## 13. Rollback Plan

Revert the `AssistantActivity` renderer to its prior bespoke activity rows, remove the foundation import from `globals.css`, and revert the additive `ToolChips` props. No database rollback or data recovery is needed.

## 14. Final Checklist

- [x] Requirements and acceptance behavior documented.
- [x] Current chat activity and primitive APIs analyzed.
- [x] Database and backend impact confirmed as none.
- [x] `ToolChips` production API implemented.
- [x] Foundation CSS safely integrated.
- [x] Reasoning and tool calls mapped to chips.
- [x] Rich outputs and sources preserved.
- [x] Accessibility and reduced motion reviewed.
- [x] Focused tests passing.
- [x] Typecheck passing.
- [x] Lint passing.
- [x] Production build passing.
- [x] Plan marked implemented.
- [ ] Deployed.
