# AI Settings Control Room Redesign

> **Status**: [ ] Planning | [ ] In Progress | [x] Implemented | [ ] Archived
>
> **Created**: 2026-08-14
>
> **Quick Checklist**:
> - [x] Existing page and behavior audited
> - [x] Responsive design direction established
> - [x] Layout and provider directory redesigned
> - [x] Workspace role configuration redesigned
> - [x] Interaction and responsive QA complete
> - [x] Lint, typecheck, and focused tests passing

## 1. Goal

Redesign `/settings/ai` into a clear workspace AI control room where administrators can understand the active answer pipeline at a glance, connect providers efficiently, and configure Thinking, Humanizer, and Knowledge roles without losing any existing behavior.

## 2. Design Direction

- **Color:** retain the product's neutral background and blue primary token; use green for ready, amber for attention, and muted blue-gray surfaces for infrastructure context.
- **Type:** preserve the application font stack; use a strong compact display heading, readable body copy, and mono utility labels for model identifiers and counts.
- **Layout:** compact page header, then a two-column control-room shell with persistent section navigation/status on the left and the active workspace on the right; collapse to one column on narrow screens.
- **Signature:** a live three-role workspace map (`Knowledge`, `Thinking`, and `Humanizer`) that makes provider roles visible as system architecture rather than generic settings cards.
- **Motion:** restrained 160–220ms state transitions for section changes and provider expansion, disabled under reduced motion.

## 3. Scope

- Reshape the page header, navigation, status summary, and content composition.
- Redesign the provider directory as denser responsive tiles with clear connection states and preserved expandable editing.
- Redesign Thinking/Humanizer and Knowledge configuration panels around the role pipeline.
- Preserve provider creation, connection testing, key replacement, enable/disable, model refresh/defaults, custom model IDs, deletion, filtering, saving, and keyboard tab behavior.
- Cover loading, empty, attention, disabled, focus, success, and error states already supported by the page.

## 4. Out of Scope

- Provider API, database, credential, model-discovery, or orchestration changes.
- Changes to chat composer behavior or workspace role semantics.
- New provider integrations.

## 5. Implementation Steps

1. Recompose `AIProviderSettings` into the control-room shell and expose live readiness in the left rail.
2. Reshape `ProviderDirectory` and `ProviderSettingsCard` into responsive expandable tiles.
3. Align workspace role and knowledge panels with the new pipeline visual language.
4. Verify desktop, mobile, keyboard navigation, filters, provider expansion, and save behavior in the running app.
5. Run focused tests, lint, and typecheck; update this checklist and status.

## 6. Validation

- Desktop and narrow-width rendered screenshots.
- Keyboard section navigation and visible focus.
- Search/filter empty state and reset.
- Expand a configured and unconfigured provider without layout breakage.
- Change-and-save workspace AI role selection, then verify persisted values.
- Lint, TypeScript, and relevant AI settings tests.

## 7. Implementation Result

- Role-first control-room shell implemented with live readiness counts and keyboard-accessible vertical navigation.
- Answer pipeline and knowledge-index lifecycle redesigned without changing their APIs or persistence contracts.
- Provider catalog converted to a responsive two-column tile system; expanded editing spans the full workspace.
- Verified at desktop and 390px widths, including provider expansion, search empty-state recovery, and a real Humanizer model save/restore through the UI.
- ESLint and TypeScript pass. Full Vitest regression passes: 35 files, 166 tests.
