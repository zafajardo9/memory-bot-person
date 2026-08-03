# PLANDESIGN.md — Liquid Glass Redesign for Kairo Chat

> Status: **PROPOSAL — awaiting approval**
> Scope: chat experience only (`app/(chat)`, `components/custom/*`, `app/globals.css`)
> Direction: liquid, glassy, fluid, modern, simple. **Blue stays the primary color.** Less shadow, less boxy, less scattered.

---

## 1. Vision

One continuous "liquid glass" language: translucent surfaces floating over a soft blue ambient background. Chrome dissolves — borders become faint light-edges, heavy shadows become blur, and scattered controls merge into a single glass composer.

Reference feel: the Hermes site aesthetic — airy, content-first, almost no visible chrome, glass used as an accent rather than decoration.

**Principles**

1. **One glass, not many boxes.** Today the screen has ~7 bordered boxes (navbar bar, logo tile, account button, agent selector, composer card, attachment tray, overview grid). After: 2 glass surfaces (navbar capsule + composer) and content that simply flows.
2. **Blur replaces shadow.** Remove all `shadow-lg`/`shadow-xl`/custom 30px shadows from chat surfaces. Depth comes from `backdrop-blur` + a 1px inner light-edge.
3. **Blue everywhere, softly.** Primary blue is used as tint (`bg-primary/8`), glow (focus, send button), and gradient — never as large flat fills.
4. **Everything is a pill or a river.** Controls are `rounded-full`; messages are a flowing column with no per-message containers.
5. **Consolidate, don't scatter.** The composer absorbs the model selector row and becomes the single control surface. The agent selector becomes a quiet ghost pill. The navbar becomes one floating capsule.

---

## 2. Current-state audit (what we're fixing)

| Element | Today | Problem |
|---|---|---|
| Composer (`multimodal-input.tsx`) | `rounded-[20px] border bg-card` + `shadow-[0_8px_30px…]` + inner `border-b` model row | Heaviest shadow in the app; 3 stacked rows feel boxy |
| Navbar (`navbar.tsx`) | Full-width `border-b` bar, bordered logo tile, account button `border bg-card shadow-sm` | Boxy chrome; 3 separate bordered widgets |
| Agent selector (`agent-selector.tsx`) | `rounded-xl border bg-card shadow-sm` + bordered initial tile | Another floating box, top-left, visually disconnected |
| User bubble (`message.tsx`) | `rounded-xl border bg-muted` + rotated-square arrow pseudo-element | Boxy; arrow reads dated |
| Assistant answer | `border-t` divider + uppercase "ANSWER" eyebrow | Visual clutter between activity and answer |
| Activity timeline (`assistant-activity.tsx`) | Colored bordered icon circles (violet/sky/emerald) | Busy multi-color nodes against the blue language |
| Overview empty state (`overview.tsx`) | 3-column grid with `border-b`/`border-r` dividers | Grid lines = boxy |
| Jump-to-latest, follow-ups, suggested actions | Bordered pills | Fine as pills — just need the glass treatment |

---

## 3. Design tokens (`app/globals.css`)

Blue stays primary. Adjust hue slightly cooler/liquid, keep contrast.

```css
:root {
  --background: 213 45% 98%;      /* faintly blue-white, was 216 20% 98% */
  --primary: 217 72% 46%;         /* brighter liquid blue, was 215 64% 38% */
  --border: 214 25% 88%;          /* softer, was 216 15% 86% */
  --radius: 1rem;                 /* more fluid, was 0.625rem */
}
.dark {
  --background: 220 22% 7%;       /* deeper, was 220 16% 8% */
  --primary: 214 85% 68%;         /* luminous blue, was 213 72% 66% */
}
```

**New utilities** (added to `@layer utilities`):

```css
.glass {
  @apply border border-white/40 bg-white/55 backdrop-blur-xl
         shadow-[inset_0_1px_0_rgba(255,255,255,0.55)];
}
.dark .glass {
  @apply border-white/[0.08] bg-white/[0.055]
         shadow-[inset_0_1px_0_rgba(255,255,255,0.07)];
}

.glass-soft {   /* smaller controls: pills, dropdowns */
  @apply border border-black/[0.06] bg-white/60 backdrop-blur-md;
}
.dark .glass-soft {
  @apply border-white/[0.07] bg-white/[0.05];
}
```

**Ambient background** — fixed, behind everything, pointer-events-none:

- Two large radial-gradient orbs: blue (`hsl(217 80% 60% / 0.14)`) top-right, cyan-blue (`hsl(200 85% 65% / 0.10)`) bottom-left, blurred ~120px.
- Dark mode: same orbs at higher alpha (0.20/0.14) so glass reads against the dark.
- Optional ultra-slow drift (`translate3d` 60s alternate, disabled under `prefers-reduced-motion` — global handler already exists).

Implementation: a `<div aria-hidden className="ambient">` mounted once in `app/(chat)/layout.tsx` (or `body::before` in CSS — CSS preferred, zero React cost).

---

## 4. Component plans

### 4.1 Navbar → floating glass capsule
`components/custom/navbar.tsx`

- From: fixed full-width `h-16 border-b bg-background/95`.
- To: fixed floating capsule — `fixed inset-x-0 top-3 z-30 mx-auto flex h-12 w-[calc(100%-24px)] max-w-5xl items-center rounded-full glass px-3`.
- Logo: **drop the bordered tile**. Keep just the blue wordmark dot — a small `size-6 rounded-full bg-gradient-to-br from-primary to-sky-400` glow-dot + "Memory" text. No border, no container.
- Divider `<span class="h-6 w-px bg-border">` → remove; spacing alone separates groups.
- Account button: drop `border bg-card shadow-sm` and the inner initial-tile border. New: `rounded-full hover:bg-foreground/5` with a bare gradient initial circle + name; menu caret appears on hover.

### 4.2 Agent selector → ghost pill, merged upward
`components/custom/agent-selector.tsx`, `components/custom/chat.tsx`

- Trigger: remove `border bg-card shadow-sm` and the bordered initial tile → `rounded-full px-2.5 py-1.5 hover:bg-foreground/5`, gradient initial dot (no border), name, caret.
- Optional consolidation: move it into the right side of the navbar capsule so the chat column has zero floating controls above messages. *(Default plan: keep it in place but ghost-styled; say the word if you want it merged into the navbar.)*
- Dropdown panel: `glass` treatment, `rounded-2xl`, `shadow-xl` → `shadow-lg/5` (barely-there).

### 4.3 Composer → the single glass river  *(biggest win)*
`components/custom/multimodal-input.tsx`

Structure collapses from 3 bordered rows into one capsule:

```
┌─────────────────────────────────────────────┐  glass, rounded-[26px]
│ [attachment chips — only when present]      │
│ Message Kairo…                              │  textarea, borderless
│ 💡Think  🧭Quick        ⚙ 🖼 📄  (send)     │  one toolbar row
└─────────────────────────────────────────────┘
```

- Container: `rounded-[26px] glass` — **delete** the `shadow-[0_8px_30px…]` and the focus shadow; delete the inner `border-b` row.
- **Model selector moves down** into the toolbar row as the first ghost pill (no more dedicated top row). `multimodal-input.tsx:271-273` row removed.
- Focus state: instead of border-color swap, a soft blue glow — `focus-within:shadow-[0_0_0_3px_hsl(var(--primary)/0.12)]` + `focus-within:border-primary/25`. Liquid, not boxed.
- Think / Quick-Deep toggles: keep the existing pill design (already good), only soften: active = `bg-primary/10 text-primary border-primary/20`; inactive = `border-transparent hover:bg-foreground/5`.
- Icon buttons (tune/image/file): ghost circles, `hover:bg-foreground/5`, no borders.
- **Send button**: the one saturated element on screen — `bg-gradient-to-br from-primary to-sky-500 text-white` circle, hover adds a faint glow `shadow-[0_4px_16px_hsl(var(--primary)/0.35)]`, press scales to `0.96` (spring 150ms). Stop button: same circle, muted red-free — keep `bg-primary`, swap icon.
- Disclaimer line below: keep, single centered line, `text-[10px] text-muted-foreground/80`; drop the `kbd` chip border (plain mono text).
- Suggested actions (empty state): keep pills → `glass-soft rounded-full`, hover lifts to `bg-primary/8 text-foreground`.

### 4.4 Messages → borderless river
`components/custom/message.tsx`

- **User bubble**: drop `border` and the arrow pseudo-element. New: `rounded-[20px] rounded-tr-md bg-primary/[0.07] px-4 py-2.5` — a soft blue tint, asymmetric corner instead of an arrow. In dark: `bg-primary/[0.12]`.
- **Assistant**: stays plain text (already right). Remove the `border-t` divider and the uppercase "ANSWER" eyebrow — replace with `mt-1` spacing; the activity rail already signals "work happened, here's the result".
- Avatars: keep bare icons (no bg) — matches the language. Assistant icon can take the gradient blue treatment (`bg-gradient-to-br from-primary to-sky-400 bg-clip-text text-transparent` is overkill — just `text-primary`).
- Action row (copy/thumbs): opacity-0 → opacity-100 on message hover (desktop), always visible on touch. Same ghost style, `hover:bg-foreground/5 rounded-full`.
- Attachments tray: drop `border bg-muted/45` → `rounded-2xl bg-foreground/[0.03] p-2.5`, uppercase label becomes normal-case `text-xs text-muted-foreground`.

### 4.5 Activity timeline → single-hue rail
`components/custom/assistant-activity.tsx`

- Rail line: `bg-border` → `bg-primary/15`.
- Node circles: from colored bordered badges → small `size-5 rounded-full bg-primary/10 text-primary` (done: `bg-primary/15`), error keeps destructive tint. Removes violet/sky/emerald scatter — everything speaks blue.
- Web search / source links: `hover:border-sky-500` → `hover:border-primary`; domain text `text-sky-*` → `text-primary`.
- Reasoning node: violet → primary blue tint, same shape.

### 4.6 Overview empty state → lighter hero
`components/custom/overview.tsx`

- Keep hero copy (it's clean). Remove the `border-b` under the headline block → spacing only.
- Capability grid: drop all `border-b`/`border-r` dividers → three airy columns, icon gets the gradient-dot treatment (`text-primary`), more whitespace (`sm:px-6`).
- Entrance motion: keep the existing 240ms fade-rise.

### 4.7 Small glass touch-ups
- Jump-to-latest (`chat.tsx:142`): `bg-background/95 shadow-lg` → `glass-soft rounded-full`, no shadow.
- Follow-up pills (`follow-up-questions.tsx`): `border bg-background` → `glass-soft`, hover `bg-primary/8`.
- All Radix dropdown panels (agent list, account menu, model panel): `glass` + `rounded-2xl` + `p-1.5`, shadow → `shadow-lg/5`.
- Scrollbar (webkit): thin, `bg-foreground/10` thumb, no track — river feel.

---

## 5. Motion guidelines

- **Keep** existing framer-motion fades (overview, messages).
- Dropdowns/menus: `scale 0.98→1 + opacity`, 140ms ease-out (Radix `data-[state=open]` animations).
- Send button press: `scale-[0.96]` spring.
- Composer focus glow: 200ms transition on box-shadow.
- No new continuous animations except the optional ambient drift; everything disabled under the existing `prefers-reduced-motion` block.

---

## 6. Accessibility & performance

- `backdrop-blur` limited to ~4 large surfaces (navbar, composer, dropdowns, jump pill) — never per-message. Cheap on GPU, no layout cost.
- Glass contrast: text never sits on glass below 4.5:1 — glass tints are ≤ 8% opacity over the near-white/near-black background.
- Focus rings: keep the global `:focus-visible` outline; on glass surfaces switch to the glow ring so outlines don't double up.
- Dark mode gets equal treatment in every phase (tokens above already tuned).

---

## 7. Phased rollout

| Phase | Files | Deliverable |
|---|---|---|
| **1. Foundation** | `app/globals.css` | New tokens, `.glass`/`.glass-soft` utilities, ambient background, radius bump, scrollbar |
| **2. Composer** | `multimodal-input.tsx`, `model-selector.tsx` | Single glass capsule, model selector merged into toolbar, glow focus, gradient send |
| **3. Messages** | `message.tsx`, `assistant-activity.tsx`, `follow-up-questions.tsx`, `chat-markdown.tsx` (if needed) | Borderless river, blue-tinted user bubble, single-hue rail |
| **4. Chrome** | `navbar.tsx`, `agent-selector.tsx`, `history.tsx`, dropdown panels | Floating glass navbar, ghost agent pill, glass menus |
| **5. Empty state** | `overview.tsx`, suggested actions | Divider-free hero, glass pills |
| **6. QA** | — | Light/dark pass, mobile (375px), reduced-motion, `pnpm run typecheck && pnpm run lint && pnpm run build` |

Each phase is independently shippable; phases 1+2 deliver most of the visual change.

## 8. Explicitly out of scope

- Knowledge/admin/settings/auth pages (same language can roll out later).
- Any backend, schema, or AI-behavior changes.
- New dependencies — pure Tailwind/CSS + existing framer-motion.
- No removal of existing functionality: every control (Think, Quick/Deep, model selector, tune, attach, feedback, follow-ups) survives, just restyled/consolidated.

---

**Decision points for you:**
1. Agent selector — ghost pill in place (default) **or** merged into the navbar capsule?
2. Ambient orbs — static (safest) **or** ultra-slow drift animation?
3. Start with phases 1+2 first, or all six in one pass?
