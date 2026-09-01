# SidebarNav Chat History

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

Replace the hamburger → slide-over session browser with the `SidebarNav` design-system primitive as a persistent, collapsible, searchable chat-history sidebar in the app shell — reusing the existing `/api/history` data without schema changes.

## 2. Context Summary

### Confirmed repository facts

- `components/primitives/SidebarNav.tsx` is a self-contained client sidebar: workspace switcher, New chat, rail nav, searchable recents (`recents: SidebarRecent[]` where `SidebarRecent = { id, label, prompt? }`), collapse 224↔52px, and a footer CTA. Its callbacks are `onNewChat`, `onPick(id, label, prompt?)`, `onNavigate(key)`, `onFooterClick`.
- Its dependencies already exist: `@central-icons-react/round-outlined-radius-2-stroke-2` (installed), `GlideMenu` primitive, and every foundation token it uses (`--color-ink/-2/-3`, `--color-surface`, `--color-hover-2`, `--color-field`, `--color-line(-strong)`, `--shadow-hairline`, `--shadow-overlay`, `--radius-control`, `pop-in` keyframes) is mapped in `app/beautifui/foundation.css` `@theme inline`, which is imported by `app/globals.css`.
- `app/beautifui/sidebar-nav.css` provides the collapse/copy/glide styles (`.sidebar-row`, `.sidebar-copy`, `.sidebar-glide-highlight`, `[data-sidebar-collapsed]` rules) but is **not imported anywhere** — the component renders unstyled/collapse-broken without it.
- The current history UI is `Sessions` in `components/custom/history.tsx`: a hamburger button in `components/custom/navbar.tsx` opening a `Sheet`, with agent-grouped sessions, delete (dropdown + confirm dialog), a New session button, and loading/error/empty states. Data comes from `useSWR("/api/history")` returning `ChatSummary[]` (`{ id, agentId, createdAt, title }`).
- `app/(chat)/layout.tsx` is a thin shell: `ActiveAgentProvider` + `<Navbar />` + children. The Navbar is a fixed floating pill; the Chat page is `h-dvh flex justify-center pt-16`.
- `SidebarNav` hardcodes demo data: `WORKSPACE` ("Creamery Ops"), `NAV_ITEMS` (Home, Invite users), footer "Upgrade".
- The floating navbar already owns primary navigation (`NavigationLinks`: Chat, Notebook, Agents, Tools), so the rail nav should stay minimal.

### Assumptions for this plan

- The sidebar mounts in `app/(chat)/layout.tsx` as a sticky left rail (`hidden md:block`) so every app-shell page shares it; the floating pill Navbar stays.
- On mobile the persistent sidebar is hidden and the existing `Sessions` hamburger Sheet stays (`md:hidden` on the button), preserving history access and per-session delete on small screens.
- `SidebarNav` receives two small additive props — `workspace?: { name, monogram }` and `navItems?: { key, label, icon, count? }[]` — both defaulting to the current demo values so the primitive's shared behavior is unchanged. The app passes `workspace` = the app name/user initial and an empty nav item list (top nav owns primary navigation).
- Recents are the flat `/api/history` list mapped to `{ id, label: title || "Untitled chat" }`; client-side search and collapse stay inside the primitive.
- `activeTitle` is derived from the current `/chat/[id]` pathname matched against the loaded sessions; the home page passes `null` (no highlight). `onPick` → `/chat/[id]`, `onNewChat` → `/`, nav `home` → `/`.
- The footer CTA is repurposed to "Tool integrations" → `/tools` with a lucide `Wrench` icon.
- Desktop per-session delete/rename from the old Sheet is dropped (the primitive has no per-item actions); mobile keeps it via the retained Sheet. Extending the primitive with row actions is a follow-up, not part of this plan.
- No database, API, or auth changes.

### Open decisions to resolve before implementation

- None. Defaults above make the scope implementable without additional product decisions.

## 3. Scope

- Import `app/beautifui/sidebar-nav.css` from `app/globals.css` so the primitive's styles apply.
- Add additive `workspace` and `navItems` props to `SidebarNav` (defaults preserve the demo).
- Add `components/custom/chat-sidebar.tsx`: a client shell that loads `/api/history`, maps it to recents, derives the active title, revalidates on pathname change, and wires routing callbacks.
- Mount the sidebar in `app/(chat)/layout.tsx` (sticky, desktop-only) and hide the `Sessions` hamburger on `md+` in `components/custom/navbar.tsx`.
- Extract pure helpers for recents mapping and active-title derivation; add unit tests.
- Update the plans table in `AGENTS.md`.

## 4. Out of Scope

- Per-item delete/rename in the persistent sidebar (mobile Sheet keeps delete).
- Customizing the workspace switcher menu contents (sign out, workspace settings stay as the primitive renders them).
- Realtime/multi-tab history sync beyond the existing pathname-change revalidation.
- Agent-grouped history sections in the sidebar (flat recents only, matching the primitive contract).
- Any schema, API route, or auth change.

## 5. Affected Files and Folders

```txt
app/
  globals.css
~   imports sidebar-nav.css
  (chat)/
~   layout.tsx            mounts the sticky rail + passes workspace identity
  beautifui/
    sidebar-nav.css       (no change — becomes imported)
components/
  primitives/
~   SidebarNav.tsx        additive workspace + navItems props
  custom/
+   chat-sidebar.tsx      client shell: history data, routing, active title
~   navbar.tsx            Sessions hamburger becomes md:hidden
tests/unit/ui/
+   chat-sidebar.test.ts  pure helper tests
~ plans/AGENTS.md         active plan table row
~ plans/sidebar-nav-chat-history/PLAN.md
```

Important path notes:

- `components/custom/chat-sidebar.tsx` is the only new app code; it reuses the SWR fetcher pattern from `history.tsx` (`useSWR("/api/history")`, `mutate()` on pathname change).
- `SidebarNav.tsx` changes are strictly additive with the demo values as defaults, so the component keeps working as the shared primitive it was designed to be.
- The mobile Sheet path (`history.tsx`) is untouched; the navbar change only hides its trigger on `md+`.

## 6. Step-by-Step Implementation Plan

### 1. Wire the sidebar stylesheet

- **What to do**: Add `@import "./beautifui/sidebar-nav.css";` to `app/globals.css` (after the foundation import, before Tailwind).
- **Why**: Without it the collapse animation, copy fade, and glide-highlight geometry have no styles.
- **Affected files**: `app/globals.css`
- **Dependencies**: None.
- **Done when**: The sidebar collapses/expands with the intended motion and rows keep icon alignment.

### 2. Extend SidebarNav with additive props

- **What to do**: Add optional `workspace?: { name: string; monogram: string }` (default `WORKSPACE`) and `navItems?: Array<{ key: string; label: string; icon: ReactNode; count?: string }>` (default `NAV_ITEMS`) props; replace the two module constants' usages inside the component with the props.
- **Why**: The app must show its real workspace identity and an empty rail nav without editing the primitive's demo data.
- **Affected files**: `components/primitives/SidebarNav.tsx`
- **Dependencies**: None.
- **Done when**: Existing demo rendering is byte-for-byte identical when the props are omitted.

### 3. Build the chat sidebar shell

- **What to do**: Create `components/custom/chat-sidebar.tsx` ("use client"): load `/api/history` via `useSWR`, map `ChatSummary[]` → `SidebarRecent[]` (label falls back to "Untitled chat"), derive `activeTitle` from `usePathname()` + the session list, `mutate()` on pathname change, and wire `onNewChat` → `/`, `onPick` → `/chat/{id}`, `onNavigate("home")` → `/`, footer → `/tools`. Accept `workspace` (name + monogram) as props from the layout.
- **Why**: The primitive is presentational; data and routing live in one thin adapter.
- **Affected files**: `components/custom/chat-sidebar.tsx`
- **Dependencies**: Steps 1 and 2.
- **Done when**: History loads, the active chat highlights, clicking a session navigates, and search filters client-side.

### 4. Mount the sidebar and adjust the navbar

- **What to do**: In `app/(chat)/layout.tsx`, wrap children in a flex row with a `sticky top-0 h-dvh` desktop-only rail (`hidden md:block`) containing `ChatSidebar` (derive the monogram from the session user); in `components/custom/navbar.tsx`, add `md:hidden` to the `Sessions` trigger so the Sheet only appears on mobile.
- **Why**: One persistent shell for the app; mobile keeps the drawer pattern.
- **Affected files**: `app/(chat)/layout.tsx`, `components/custom/navbar.tsx`
- **Dependencies**: Step 3.
- **Done when**: Desktop shows the rail + pill navbar without layout overflow; mobile shows the navbar hamburger exactly as before.

### 5. Test and verify

- **What to do**: Extract pure helpers (`sessionsToRecents`, `activeChatTitle`) into the shell file and unit-test them; run lint, typecheck, unit tests, and a production build.
- **Why**: Mapping and title derivation are the only logic worth pinning; the rest is routing.
- **Affected files**: `components/custom/chat-sidebar.tsx`, `tests/unit/ui/chat-sidebar.test.ts`
- **Dependencies**: Steps 3 and 4.
- **Done when**: All repository checks pass or any environment-only limitation is documented with the exact failed command.

## 7. Database Changes

None. The sidebar consumes the existing `/api/history` endpoint and `ChatSummary` shape.

## 8. Backend Changes

None beyond reusing the existing authenticated history endpoint.

## 9. Frontend Changes

- `components/custom/chat-sidebar.tsx` — client shell (history data, active-title derivation, routing).
- `components/primitives/SidebarNav.tsx` — additive `workspace`/`navItems` props.
- `app/(chat)/layout.tsx` — sticky desktop rail.
- `components/custom/navbar.tsx` — hide the Sessions trigger on `md+`.
- `app/globals.css` — import the sidebar stylesheet.

## 10. Validation Rules

- `recents` labels: trimmed title, falling back to "Untitled chat" when empty; ids are raw session ids.
- `activeTitle`: matched by session id from the `/chat/[id]` pathname; `null` on the home page and when unmatched.
- Pathname revalidation keeps the same SWR key and options as the existing history component.
- No client-supplied ids are ever sent to the server; navigation only uses ids already returned by the authenticated history endpoint.

## 11. Security Considerations

- No new server surface: the sidebar only reads the existing authenticated `/api/history` endpoint.
- History titles are rendered as plain text (React escapes), matching current behavior.
- The layout derives the monogram from the authenticated session only.

## 12. Testing Plan

### Unit tests

- `sessionsToRecents`: maps `ChatSummary[]` → `SidebarRecent[]`, falls back to "Untitled chat" for empty titles.
- `activeChatTitle`: returns the current session title for `/chat/{id}`, `null` for `/` and unknown ids.

### E2E/manual QA

- Desktop: sidebar renders, expands/collapses, searches chats, opens the active chat highlighted, New chat goes to `/`, footer goes to `/tools`.
- Desktop: history revalidates after a chat title changes or a session is deleted (via mobile path or API).
- Mobile: hamburger opens the existing Sheet; the persistent rail is absent; delete still works from the Sheet.
- Light and dark themes: tokens render correctly in both.
- Verify no horizontal scrollbar appears on the chat page with the rail mounted.

## 13. Rollback Plan

- Remove the `SidebarNav` import and wrapper from `app/(chat)/layout.tsx`, and the `md:hidden` class from the navbar trigger — the app returns to the Sheet-only history.
- Optionally revert `SidebarNav.tsx` prop additions (they are additive and harmless).
- No database or API rollback is needed.

## 14. Final Checklist

- [x] Existing architecture and dirty worktree reviewed
- [x] Scope and defaults resolved
- [x] SidebarNav dependencies verified (icons, GlideMenu, tokens, missing stylesheet)
- [x] Sidebar stylesheet imported
- [x] SidebarNav additive props implemented
- [x] Chat sidebar shell implemented
- [x] Layout mount and navbar adjustment complete
- [x] Unit tests added and passing (214 tests total)
- [x] Lint and typecheck pass
- [x] Production build passes
- [x] Follow-up: per-chat agent identity chips (colored monogram + name tooltip)
- [x] Follow-up: hover delete action on recent chats (confirm + toast + redirect)
- [ ] Plan status marked Implemented
