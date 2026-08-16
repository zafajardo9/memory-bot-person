# Chat Experience Gold-Standard Upgrade

> **Status**: [x] Planning | [ ] In Progress | [x] Implemented | [ ] Archived
>
> **Created**: 2026-08-16
>
> **Implemented**: 2026-08-16
>
> **Quick Checklist**:
> - [x] Requirements gathered
> - [x] Codebase analyzed
> - [x] Phase 1: Citation chips linked to evidence cards
> - [x] Phase 2: Message rendering performance (memoization)
> - [x] Phase 3: Message actions (regenerate, edit & resend)
> - [x] Phase 4: Streaming feel (caret, elapsed timer, entrance motion)
> - [x] Phase 5: Composer upgrades (drafts, keyboard, segmented depth)
> - [x] Phase 6: Chat API route hardening
> - [x] Tests passing (188/188, 9 new citation tests; lint and typecheck clean)
> - [ ] Deployed

### Implementation notes (2026-08-16)

- Draft persistence is scoped by agent on the new-chat screen (its chat id
  regenerates every load) and by chat id on `/chat/[id]`.
- The draft hook uses `useSyncExternalStore` over localStorage (hydration-safe,
  satisfies the repo's `react-hooks/set-state-in-effect` rule).
- `maxDuration` was left to the existing `vercel.json` functions config; the
  route only gained `runtime = "nodejs"`, friendly 400s, and the ownership
  pre-check.
- Verified live in the browser: registration → chat, segmented depth control,
  draft restore after reload, streaming round-trip, Edit & resend truncation,
  Retry affordance. The two Next dev-overlay issues observed (version
  staleness notice, `next-themes` script-tag warning in `theme-provider.tsx`)
  pre-date this plan.
- Follow-up (same day): the slash-command skill picker was compacted — its
  header row and footer link merged into one footer bar (status text, ↑↓·↵
  hint, "Create or manage skills" link), and skill rows became single-line
  entries with a bold name and slash slug, no icon, scrollable list.

## 1. Goal

Raise the chat surface to a gold-standard assistant experience (inline linked
citations, full message actions, premium streaming feedback) and harden the
chat API entry point — without touching the theme, branding, or the
Grainient/glass visual identity, and without breaking any existing API or
database contract.

## 2. Design principles

- **Brand-locked**: no changes to color tokens, `glass` utilities, Geist,
  pill shapes, or the animated background. New UI builds only on existing
  tokens (`primary`, `muted-foreground`, `border`, `rounded-full` chips).
- **Pure logic in `lib/`**: every new behavior that can be a pure function
  (citation parsing, registry building, draft keys) lives in `lib/ai/` with
  unit tests, so future surfaces (mobile, agent studio previews) can reuse it.
- **Zero contract change**: the model keeps emitting `【Title — location】`
  citations; the chat API request/response shape is unchanged. All chip
  behavior is client-side rendering plus anchors that already exist in tool
  output (`chunkId`, `citation`).
- **Additive-only**: no schema changes, no new dependencies. Motion uses the
  already-installed `tw-animate-css` + CSS so the global
  `prefers-reduced-motion` override keeps working.

## 3. Context Summary

### Confirmed repository facts

- The system prompt instructs the model to cite with `【title — section or
  page】`; `normalizeChatMarkdown` passes these through, so users see raw CJK
  brackets in answers.
- `searchCompanyKnowledge` tool output already includes `chunkId`, `title`,
  `citation` per result and is rendered as expandable evidence cards by
  `KnowledgeSourceCards`.
- `Message` (`components/custom/message.tsx`) is not memoized; every streamed
  token re-renders the whole transcript and re-parses markdown per message.
- `useChat` (AI SDK 7) exposes `setMessages` and `regenerate`, but the UI only
  surfaces `regenerate` on errors, and user messages cannot be edited.
- The composer has no draft persistence; Esc does not stop generation.
- `POST /api/chat` parses the body with `zod` but returns raw `error.message`
  on failure and does not pre-check chat ownership before streaming
  (ownership is enforced later in `saveChat`, which would fail the save after
  the stream completes).
- Vitest suite covers `lib/` pure modules; `tests/unit/ai/chat-markdown.test.ts`
  already tests markdown normalization.

## 4. Phases

### Phase 1 — Citation chips linked to evidence (identity feature)

New pure module `lib/ai/citations.ts`:

- `CITATION_PATTERN` matching `【…】`.
- `normalizeCitationKey(value)` — trim/collapse whitespace for matching.
- `buildCitationRegistry(toolParts)` — walk `searchCompanyKnowledge` (and
  `readCompanyKnowledge`) outputs in message order and map citation key →
  `{ chunkId?, number }` with stable first-appearance numbering.
- `applyCitationMarkup(content, registry)` — replace each `【…】` with a
  markdown link `[[n]](kairo-citation:<encoded key>)`, leaving unmatched
  citations as chips without targets.

Rendering:

- `ChatMarkdown` accepts an optional citation registry; its custom `a`
  component intercepts the `kairo-citation:` scheme and renders a compact
  numbered chip instead of a link. Chips without a target render muted.
- `KnowledgeSourceCards` anchors each card with `id="cite-<chunkId>"`.
- Chip click: open the target `<details>` card, scroll it into view, and
  flash it via a short CSS highlight class (respects reduced motion).

Acceptance: an answer containing `【…】` renders numbered chips; clicking a
chip whose citation came from a knowledge search scrolls to and opens the
matching evidence card; unmatched citations render as inert chips; raw
brackets no longer appear.

### Phase 2 — Message rendering performance

- Wrap `Message` in `React.memo` (default shallow compare; AI SDK preserves
  object identity for untouched messages).
- Stabilize `onSelectFollowUp` in `chat.tsx` with `useCallback`.
- Memoize `ChatMarkdown` so completed messages do not re-parse markdown on
  every stream tick.

Acceptance: during streaming, only the active message subtree re-renders;
completed messages keep identity across sibling updates.

### Phase 3 — Message actions

- Assistant messages (last, not loading): add **Regenerate** to the existing
  hover action row (Copy, feedback) calling `regenerate()`.
- User messages: **Edit & resend** — inline textarea replacing the bubble
  (Enter saves, Esc cancels); saving truncates the conversation at that
  message via `setMessages` and calls `sendMessage` with the new text plus
  the original file parts.

Acceptance: regenerate re-streams a fresh answer; editing a user message
resumes the conversation from the edited turn with attachments preserved.

### Phase 4 — Streaming feel

- Blinking caret after the streaming answer text (CSS animation, already
  neutralized by the global reduced-motion block).
- Elapsed-seconds counter on the live "Researching…" / "Composing…" header in
  `AssistantActivity`.
- Entrance animations for messages, follow-up chips, and the queued-message
  pill using `tw-animate-css` utilities.

Acceptance: streaming shows a caret and a live timer; new content fades in
subtly; `prefers-reduced-motion` disables all of it.

### Phase 5 — Composer upgrades

- `lib/ai/use-chat-draft.ts`: per-chat draft persistence in `localStorage`
  (`kairo:chat-draft:<chatId>`), restored on mount, cleared on submit.
- Keyboard: `Esc` stops generation (when the skill picker is not consuming
  it), `⌘/Ctrl+Enter` also sends.
- Quick/Deep becomes a compact two-segment control; Thinking status chip
  styling unified with it.

Acceptance: drafts survive a page reload per chat; Esc stops an in-flight
answer; the control row reads as one coherent cluster in both themes.

### Phase 6 — Chat API route hardening

`app/(chat)/api/chat/route.ts`:

- `safeParse` with a friendly 400 message instead of echoing `error.message`.
- Pre-check `existingChat.userId === session.user.id` before streaming (the
  current path discovers foreign chats only when the post-stream save throws).
- Explicit `export const runtime = "nodejs"` and `maxDuration` for
  future-proof deployment targets.

Acceptance: malformed bodies return a stable JSON error; foreign chat ids are
rejected with 403 before any model call; happy path unchanged.

## 5. File plan

| File | Change |
| --- | --- |
| `lib/ai/citations.ts` | New pure citation parsing/registry/markup module |
| `tests/unit/ai/citations.test.ts` | New unit tests for the above |
| `components/custom/chat-markdown.tsx` | Citation-aware renderer + chip component |
| `components/custom/knowledge-source-cards.tsx` | `cite-<chunkId>` anchors + flash style |
| `components/custom/message.tsx` | Registry build, memo, action row, edit mode |
| `components/custom/chat.tsx` | Stable callbacks, regenerate/edit wiring |
| `components/custom/assistant-activity.tsx` | Elapsed timer |
| `components/custom/multimodal-input.tsx` | Drafts, Esc/⌘↵, segmented depth control |
| `lib/ai/use-chat-draft.ts` | New draft persistence hook |
| `app/globals.css` | Caret keyframes + citation flash |
| `app/(chat)/api/chat/route.ts` | Validation/ownership/runtime hardening |
| `AGENTS.md` | Plan table entry |

## 6. Risks and mitigations

- **Model emits partial `【…` mid-stream** — the parser only replaces
  complete pairs; partial text renders literally until closed (same behavior
  as today, no regression).
- **Duplicate citation strings across searches** — registry keeps the first
  chunkId; later duplicates reuse the same chip number (deduplication is the
  desired UX).
- **Memo compare staleness** — default shallow compare relies on AI SDK
  preserving message identity for untouched messages; verified in Phase 2
  acceptance and reversible by removing the wrapper.
- **Edit & resend history loss** — truncation is explicit user intent, shown
  in the edit UI ("resend replaces later messages"); chat save happens on
  finish as before.

## 7. Out of scope (future plans)

- Sidebar/chat history redesign, message virtualization, branching variants,
- server-side citation resolution via structured output,
- prompt changes to the citation format itself.
