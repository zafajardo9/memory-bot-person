# Framework, Technology & Dependency Upgrade

> **Status**: [x] Planning | [ ] In Progress | [x] Implemented | [ ] Archived
>
> **Created**: 2026-07-20
>
> **Implemented**: 2026-07-20
>
> **Quick Checklist**:
> - [x] Requirements gathered
> - [x] Codebase analyzed
> - [x] Phase 1: Non-breaking patch & minor upgrades
> - [x] Phase 2: TypeScript 5.x → latest compatible 5.x + @types/node upgrade
> - [x] Phase 3: AI SDK v3 → v7 migration
> - [x] Phase 4: Next.js 15.5 → 16.2 + React 19.x
> - [x] Phase 5: Tailwind CSS v3 → v4 migration
> - [x] Phase 6: Prisma 7.8 verified current
> - [x] Phase 7: ESLint 8 → 9 (flat config)
> - [x] Phase 8: next-auth beta verified current
> - [x] Phase 9: Remaining dependency upgrades
> - [x] Full test suite passing
> - [x] Production build successful
> - [ ] Deployed

### Implementation result

Implemented locally on 2026-07-20 against the current npm registry, superseding
the originally estimated major-version targets where newer stable releases were
available. The final stack uses Next.js 16.2, React 19.2, AI SDK 7, Tailwind CSS
4.3, ESLint 9.39 flat config, TypeScript 5.9, Node.js 22 types, and Prisma 7.8.
ESLint 10 and TypeScript 7 are intentionally not selected because the current
Next.js TypeScript lint stack does not yet support those majors. Prisma 7.8,
Vitest 4.1, Google GenAI 2.12, and NextAuth 5 beta.31 were already current.

Validation completed locally: clean peer dependency check, zero known audit
vulnerabilities, zero-error lint and typecheck, 24 passing tests, Prisma client
generation and migration deployment check, successful Next.js production build,
and unauthenticated route/auth endpoint smoke checks. Staging, production
deployment, authenticated Gemini calls, file uploads, and the 48-hour monitoring
window remain environment/operator tasks.

---

## 1. Goal

Update every framework, technology, and dependency in the project to their latest stable versions while maintaining full application functionality, passing all tests, and producing a clean production build. This ensures the codebase benefits from the latest performance improvements, security patches, TypeScript typings, and API enhancements.

---

## 2. Context Summary

### Confirmed repository facts

- **Framework**: Next.js 15.5.7 with App Router (source in `app/`)
- **Runtime/Language**: TypeScript ^5 targeting ESNext, Node.js 20+ types (`@types/node@^20`)
- **AI / LLM**: Vercel AI SDK `ai@3.4.9`, `@ai-sdk/google@^0.0.51`, `@google/genai@^2.12.0`; Gemini 2.5 Pro (primary) and 2.5 Flash (structured gen); Gemini `gemini-embedding-2` for knowledge embeddings
- **Authentication**: `next-auth@5.0.0-beta.31` (Auth.js v5 beta) with credentials provider and bcrypt-ts; protected routes via `middleware.ts`
- **Database ORM**: Prisma 7.8.0 (`@prisma/client`, `prisma`, `@prisma/adapter-pg`, `@prisma/extension-accelerate`); PostgreSQL with `pgvector` extension; custom client output to `lib/generated/prisma/`
- **Styling**: Tailwind CSS ^3.4.1 with `tailwindcss-animate` plugin; shadcn/ui components; CSS variables theme (zinc base color); `tailwind-merge` + `class-variance-authority`
- **UI**: Radix UI primitives (alert-dialog, dialog, dropdown-menu, label, slot, tooltip, visually-hidden); `lucide-react` icons; `framer-motion` animations; `sonner` toasts; `geist` font
- **State / Data**: SWR ^2.2.5 for client-side fetching; `usehooks-ts` utility hooks
- **Validation**: zod ^3.23.8 for schema validation; `input-otp` for OTP input
- **File Storage**: `@vercel/blob@^0.24.1` for knowledge source file uploads; `cheerio` for web page scraping; `mammoth` for DOCX parsing; `pdf-parse` for PDF text extraction
- **Analytics**: `@vercel/analytics@^1.3.1`
- **Testing**: `vitest@^4.1.10` with node environment, test files in `tests/**/*.test.ts`
- **Linting**: ESLint 8 (`^8.57.0`) with `.eslintrc.json` (legacy config format); `eslint-config-next@15.5.7`; import and tailwindcss plugins
- **Build Tools**: PostCSS ^8, `tsx@^4.19.1` for script execution, dotenv ^16.4.5
- **Package Manager**: pnpm with `pnpm-workspace.yaml` (allows builds for native modules: @google/genai, prisma, esbuild, sharp, protobufjs, unrs-resolver)
- **Deployment Target**: Vercel-like hosting (inferred from @vercel/blob, @vercel/analytics, next build); Prisma Compute support via `.agents/skills/prisma-compute`
- **Generated Prisma client**: Custom output path `lib/generated/prisma/` (not standard `node_modules/.prisma/client`)

### Assumptions for this plan

- Node.js runtime will be upgraded to ≥22 LTS alongside the dependency upgrades
- The application will remain on Next.js App Router (pages router is not used except in `pages/` directory reference in tailwind config)
- PostgreSQL with pgvector will remain the database (no migration to another DB)
- Vercel AI SDK v4 API changes are manageable and won't require a complete AI pipeline rewrite
- Tailwind CSS v4 migration can be done incrementally via the upgrade tooling
- Prisma 7.8 → latest stays within the 7.x line; if Prisma 8 is released, a separate dedicated migration plan will be needed
- Auth.js v5 may still be in beta; the plan accounts for this
- All Radix UI and shadcn/ui components will remain compatible with React 19.x

### Open decisions to resolve before implementation

- Confirm target Node.js version (22 LTS vs 24 LTS) for production and local development
- Determine if ESLint flat config migration should happen before or after the codebase upgrades (order matters for `eslint-config-next` compatibility)
- Decide whether to adopt Tailwind CSS v4's new CSS-first configuration or maintain backward-compatible `@config` directive approach
- Verify if `next-auth@5.0.0-beta` has a stable release or if we should pin to a later beta
- Confirm Google GenAI SDK (`@google/genai`) v2→latest compatibility with the Vercel AI SDK Google provider

---

## 3. Scope

- Upgrade all `dependencies` and `devDependencies` in `package.json` to latest compatible versions
- Migrate ESLint from v8 (legacy `.eslintrc.json`) to v9 (flat config `eslint.config.mjs`)
- Migrate Tailwind CSS from v3 to v4 (new configuration model, CSS-first approach)
- Migrate Vercel AI SDK from v3 to v4 (breaking API changes in `ai` and `@ai-sdk/google`)
- Upgrade Next.js from 15.5.7 to latest 15.x or 16.x stable
- Upgrade React from 19.2.1 to latest 19.x
- Upgrade TypeScript to latest 5.x
- Upgrade Prisma within the 7.x line to latest
- Upgrade all Radix UI, utility, and tooling packages
- Regenerate Prisma client after ORM upgrades
- Run and fix the full test suite
- Run and fix the production build
- Update `pnpm-workspace.yaml` if new native build requirements emerge
- Update CI/CD pipelines if Node.js version needs bumping

---

## 4. Out of Scope

- Replacing Next.js with another framework (e.g., TanStack Start, Remix)
- Replacing Prisma with Drizzle or another ORM (note: `lib/drizzle/` folder exists but is apparently unused)
- Replacing PostgreSQL with another database
- Migrating from Auth.js/next-auth to Clerk or another auth provider
- Replacing Vercel AI SDK with direct Google GenAI SDK calls or LangChain
- Adding new features or modifying application behavior beyond what's needed for compatibility
- Cleaning up the unused `lib/drizzle/` directory (separate housekeeping task)
- Changing the Prisma client output path (`lib/generated/prisma/`)
- Adopting React Server Components patterns not already used (no architecture changes)
- Updating `geist` font to latest version unless a breaking change is identified

---

## 5. Affected Files and Folders

```txt
~ package.json                      (version bumps, dependency alignment)
~ pnpm-workspace.yaml               (native build allow-list updates if needed)
~ pnpm-lock.yaml                    (regenerated by pnpm install)
~ tsconfig.json                     (target/lib adjustments for new TypeScript)
~ next.config.mjs                   (Next.js config migration if v16 introduces changes)
~ tailwind.config.ts                (migrate to Tailwind v4 CSS configuration)
~ postcss.config.mjs                (Tailwind v4 PostCSS plugin update)
~ .eslintrc.json                    (delete; migrate to eslint.config.mjs)
+ eslint.config.mjs                 (ESLint v9 flat config)
~ middleware.ts                     (verify next-auth middleware compatibility)
~ app/globals.css                   (Tailwind v4 CSS-first directives)
~ app/layout.tsx                    (verify React 19.x + Next.js compatibility)
~ components.json                   (shadcn/ui config update for Tailwind v4)
~ prisma/schema.prisma              (verify Prisma version compatibility, regenerate)
~ prisma.config.ts                  (verify Prisma config compatibility)
~ lib/prisma.ts                     (verify Prisma client import after regeneration)
~ lib/ai-settings.ts                (verify AI SDK v4 Google provider compatibility)
~ lib/knowledge/                    (verify embedding and tool APIs after AI SDK upgrade)
~ ai/index.ts                       (AI SDK v4 API migration: model creation, provider setup)
~ ai/custom-middleware.ts           (AI SDK v4 middleware type changes)
~ ai/actions.ts                     (AI SDK v4 structured generation API changes)
~ ai/knowledge-tools.ts             (AI SDK v4 tool definition API changes)
~ ai/prompts/                       (verify prompt format compatibility)
~ app/(chat)/api/chat/route.ts      (AI SDK v4 streamText/streamUI API changes)
~ db/knowledge-queries.ts           (verify Prisma client API after upgrade)
~ db/queries.ts                     (verify Prisma client API after upgrade)
~ db/types.ts                       (verify Prisma type compatibility)
~ components/custom/                (verify React 19.x + Next.js 15.x+ compatibility)
~ components/knowledge/             (verify React 19.x + Next.js 15.x+ compatibility)
~ components/ui/                    (shadcn/ui component registry updates if needed)
~ tests/**/*.test.ts                (verify test compatibility with upgraded vitest)
~ vitest.config.ts                  (verify vitest 4.x configuration compatibility)
```

### Important path notes

- `ai/index.ts` is the model factory — it creates Google Generative AI instances via `createGoogleGenerativeAI` and wraps them. This is the primary file affected by AI SDK v4 migration.
- `ai/custom-middleware.ts` currently exports an empty middleware object. The `Experimental_LanguageModelV1Middleware` type will change in AI SDK v4.
- `ai/actions.ts` uses Gemini Flash for structured generation. The `generateObject`/`streamObject` API surface changes in AI SDK v4.
- `ai/knowledge-tools.ts` defines `searchCompanyKnowledge`, `readCompanyKnowledge`, and `listCompanyKnowledgeSources` tools. Tool definition APIs changed between AI SDK v3 and v4.
- `app/(chat)/api/chat/route.ts` is the streaming chat endpoint that orchestrates tool calls. The `streamText` API changes in v4.
- `lib/ai-settings.ts` manages Gemini API key encryption/storage. The Google provider configuration may need updating for AI SDK v4.
- `middleware.ts` uses `NextAuth(authConfig).auth`. Verify no breaking changes in the next-auth beta version upgrade.
- `app/globals.css` currently uses Tailwind v3 `@tailwind base/components/utilities` directives. Tailwind v4 uses `@import "tailwindcss"` instead.
- `tailwind.config.ts` will be significantly reduced or replaced in Tailwind v4 which favors CSS-based configuration.
- `components.json` references `tailwind.config.ts` — shadcn/ui will need a Tailwind v4-compatible configuration.
- `pnpm-workspace.yaml` allows native builds for `@google/genai`, `prisma`, `esbuild`, `sharp`, `protobufjs`, `unrs-resolver`. New versions may add or remove native build requirements.
- `lib/generated/prisma/` is the custom Prisma client output directory. After `prisma generate`, imports from `@/lib/prisma` that re-export from this directory must be verified.

---

## 6. Step-by-Step Implementation Plan

### Phase 1: Safe baseline — patch and minor upgrades (non-breaking first)

#### Step 1. Create a git checkpoint

- **What to do**: Commit all current changes and create a tag (`pre-upgrade`) so every subsequent phase can be rolled back independently.
- **Why**: The upgrade touches every layer of the stack. A clean git state allows per-phase reversion without losing progress on earlier phases.
- **Affected files**: `.git` (tag creation only)
- **Dependencies**: None

#### Step 2. Audit current versions and identify latest targets

- **What to do**: Run `pnpm outdated` on every dependency (both `dependencies` and `devDependencies`). Record the current → latest version for each package. Categorize into: (a) patch/minor within same major, (b) major version jumps.
- **Why**: Informs upgrade order — patch/minor upgrades can be done in bulk first to reduce the surface area before tackling breaking changes.
- **Affected files**: None (informational only)
- **Dependencies**: Step 1

#### Step 3. Upgrade all non-breaking patch and minor dependencies

- **What to do**: For packages where the latest version shares the same major version as the current, run `pnpm update <package>@latest`. This includes packages like `zod@^3.23.8 → 3.x latest`, `date-fns@^4.1.0 → 4.x latest`, `sonner`, `swr`, `lucide-react`, `class-variance-authority`, `clsx`, `classnames`, `framer-motion`, `tailwind-merge`, `usehooks-ts`, `dotenv`, `input-otp`, `next-themes`, `server-only`, `streamdown`, `cheerio`, `mammoth`, `pdf-parse`, `bcrypt-ts`, `geist`, `pg`, `@vercel/analytics`, `@vercel/blob`, `tsx`, `@types/pg`, `@types/pdf-parse`, and all Radix UI packages.
- **Why**: Reduces the number of variables when debugging breaking changes later. Patch and minor upgrades carry the lowest risk.
- **Affected files**: `package.json`, `pnpm-lock.yaml`
- **Dependencies**: Step 2

#### Step 4. Verify the application after minor upgrades

- **What to do**: Run `pnpm build` (which includes `prisma generate && prisma migrate deploy`) and `pnpm test`. Fix any deprecation warnings or minor compatibility issues.
- **Why**: Establishes a clean baseline before introducing major breaking changes.
- **Affected files**: Any file with deprecation warnings
- **Dependencies**: Step 3

---

### Phase 2: TypeScript and Node.js type upgrades

#### Step 5. Upgrade TypeScript to latest 5.x

- **What to do**: Change `typescript` from `^5` to the latest 5.x (e.g., `~5.9.0` or whatever is latest). Run `pnpm install`. Run `pnpm typecheck` (`tsc --noEmit`) and fix any new type errors.
- **Why**: Newer TypeScript versions catch more issues at compile time and improve editor support. Staying on latest 5.x avoids the TS 6 breaking change boundary.
- **Affected files**: `package.json`, `pnpm-lock.yaml`, potentially `tsconfig.json` (if `target` or `lib` need adjustment)
- **Dependencies**: Step 4

#### Step 6. Upgrade @types/node to match target Node.js version

- **What to do**: Change `@types/node` from `^20` to `^22` (matching Node.js 22 LTS). If Node.js 24 is preferred, use `^24`. Update `tsconfig.json` `lib` and `target` if needed. Run `pnpm typecheck` and fix any type mismatches (e.g., newer `fetch` types, crypto APIs).
- **Why**: Ensures TypeScript types match the actual runtime. Node.js 20 → 22 introduces new globals and API changes that `@types/node` must reflect.
- **Affected files**: `package.json`, `pnpm-lock.yaml`, `tsconfig.json`
- **Dependencies**: Step 5

---

### Phase 3: AI SDK v3 → v4 migration (highest-risk breaking change)

#### Step 7. Research AI SDK v4 migration guide

- **What to do**: Review the official Vercel AI SDK v3 → v4 migration documentation. Identify every API change affecting: `streamText`, tool definitions, model provider creation (`createGoogleGenerativeAI`), middleware, structured generation (`generateObject`/`streamObject`), and `LanguageModelV1Middleware`.
- **Why**: AI SDK v4 has significant API redesign. Understanding all changes before touching code prevents partial migrations and broken intermediate states.
- **Affected files**: None (research only)
- **Dependencies**: Step 6

#### Step 8. Upgrade AI SDK packages

- **What to do**: Update `ai` from `3.4.9` to latest v4, `@ai-sdk/google` from `^0.0.51` to latest, and `@google/genai` from `^2.12.0` to latest. Run `pnpm install`.
- **Why**: The AI SDK is the core of the application's chat and knowledge features. This must be upgraded atomically because v3 and v4 packages cannot coexist.
- **Affected files**: `package.json`, `pnpm-lock.yaml`
- **Dependencies**: Step 7

#### Step 9. Migrate model factory (`ai/index.ts`)

- **What to do**: Update `createGoogleGenerativeAI` usage to match v4 API. Update `experimental_wrapLanguageModel` / `wrapLanguageModel` import path (moved from `ai` to `ai/middleware` or similar in v4). Update model name strings if Gemini model naming changed. Update the `customMiddleware` type reference.
- **Why**: This is the model creation entrypoint. Every chat and tool call flows through these models.
- **Affected files**: `ai/index.ts`, `ai/custom-middleware.ts`
- **Dependencies**: Step 8

#### Step 10. Migrate chat route (`app/(chat)/api/chat/route.ts`)

- **What to do**: Update `streamText` call to match v4 API. Update tool execution patterns. Update message format handling. Update stream consumer if the response shape changed.
- **Why**: The streaming chat endpoint is the primary user-facing feature. Must work correctly before proceeding.
- **Affected files**: `app/(chat)/api/chat/route.ts`
- **Dependencies**: Step 9

#### Step 11. Migrate knowledge tools (`ai/knowledge-tools.ts`)

- **What to do**: Update tool definitions (`tool()` function API changed in v4). Update `searchCompanyKnowledge`, `readCompanyKnowledge`, and `listCompanyKnowledgeSources` tool schemas and execute functions.
- **Why**: Knowledge retrieval tools are critical for the "source of truth" behavior.
- **Affected files**: `ai/knowledge-tools.ts`, `lib/knowledge/retrieval.ts` (if tool execution helpers changed)
- **Dependencies**: Step 10

#### Step 12. Migrate structured generation (`ai/actions.ts`)

- **What to do**: Update `generateObject` / `streamObject` calls to match v4 API. Verify the Google Generative AI provider works with structured output in v4.
- **Why**: Structured generation is used for knowledge processing and other admin operations.
- **Affected files**: `ai/actions.ts`, `ai/prompts/`
- **Dependencies**: Step 9

#### Step 13. Update AI settings and provider configuration

- **What to do**: Verify `getGeminiApiKey()` integration works with the upgraded `@ai-sdk/google`. Update `lib/ai-settings.ts` if the Google provider configuration format changed.
- **Why**: AI key management must continue working for the application to function.
- **Affected files**: `lib/ai-settings.ts`
- **Dependencies**: Step 9

#### Step 14. Verify AI features end-to-end

- **What to do**: Manually test chat streaming, knowledge tool retrieval, structured generation, and embedding generation (if the embedding API changed). Verify tool calls produce correct citations and source excerpts.
- **Why**: AI SDK v4 migration has the highest risk of subtle behavioral changes.
- **Affected files**: None (manual verification)
- **Dependencies**: Steps 9–13

---

### Phase 4: Next.js and React upgrades

#### Step 15. Upgrade Next.js to latest 15.x or 16.x stable

- **What to do**: Update `next` from `15.5.7` to latest stable. Update `eslint-config-next` to match. Run `pnpm install`. Review Next.js upgrade guide for any breaking changes.
- **Why**: Next.js updates bring performance improvements, security fixes, and new features. The jump from 15.5.7 to latest 15.x is smaller than 15→16.
- **Affected files**: `package.json`, `pnpm-lock.yaml`, potentially `next.config.mjs`, `middleware.ts`
- **Dependencies**: Step 14

#### Step 16. Upgrade React and React DOM

- **What to do**: Update `react` and `react-dom` from `19.2.1` to latest 19.x. Update `@types/react` and `@types/react-dom` to match. Run `pnpm install`.
- **Why**: React point releases include bug fixes and type improvements. Staying on React 19 avoids the 20 migration boundary.
- **Affected files**: `package.json`, `pnpm-lock.yaml`
- **Dependencies**: Step 15 (Next.js and React versions are coupled)

#### Step 17. Verify Next.js build and runtime

- **What to do**: Run `pnpm build`. Fix any build errors from Next.js or React upgrades. Run `pnpm dev` and smoke-test core pages (chat, knowledge, admin, auth).
- **Why**: The build must succeed before proceeding to more breaking changes.
- **Affected files**: Any file with build errors
- **Dependencies**: Steps 15–16

---

### Phase 5: Tailwind CSS v3 → v4 migration

#### Step 18. Upgrade Tailwind CSS packages

- **What to do**: Update `tailwindcss` from `^3.4.1` to `^4`, `tailwindcss-animate` to Tailwind v4-compatible version, and `postcss` if needed. Run the official Tailwind CSS upgrade tool: `npx @tailwindcss/upgrade@next` (or stable equivalent at time of execution).
- **Why**: Tailwind v4 has a fundamentally different configuration model. The upgrade tool automates most of the migration.
- **Affected files**: `package.json`, `pnpm-lock.yaml`, `tailwind.config.ts`, `postcss.config.mjs`, `app/globals.css`
- **Dependencies**: Step 17

#### Step 19. Migrate global CSS to Tailwind v4

- **What to do**: Replace `@tailwind base/components/utilities` directives with `@import "tailwindcss"`. Migrate CSS variable theme configuration from `tailwind.config.ts` to CSS-first `@theme` blocks in `app/globals.css`. Migrate the `darkMode: ["class"]` configuration to the v4 equivalent.
- **Why**: Tailwind v4 moves configuration from JS to CSS. The theme tokens (colors, borderRadius, fontFamily) must be expressed in the new format.
- **Affected files**: `app/globals.css`, `tailwind.config.ts` (significantly reduced or removed)
- **Dependencies**: Step 18

#### Step 20. Update Tailwind plugin configuration

- **What to do**: Migrate `tailwindcss-animate` plugin import from `tailwind.config.ts` `plugins` array to CSS `@plugin` directive. Verify the `safelist` from `tailwind.config.ts` works in v4 (may need `@source` or explicit safelist in CSS).
- **Why**: Plugins in v4 are loaded via CSS `@plugin` instead of JS config.
- **Affected files**: `app/globals.css`, `tailwind.config.ts` (if still needed for partial config)
- **Dependencies**: Step 19

#### Step 21. Update shadcn/ui components and config

- **What to do**: Update `components.json` for Tailwind v4 compatibility. Run `npx shadcn@latest init` or the migration command to regenerate the component registry. Verify all shadcn/ui components in `components/ui/` render correctly.
- **Why**: shadcn/ui components rely on Tailwind CSS class patterns. The migration may require regenerating or patching component files.
- **Affected files**: `components.json`, `components/ui/*.tsx`, possibly `lib/utils.ts` (cn utility)
- **Dependencies**: Step 20

#### Step 22. Verify Tailwind v4 visual output

- **What to do**: Run `pnpm dev` and visually inspect all pages: login, register, chat, knowledge management, admin settings, and landing. Check light and dark mode. Verify that animations, hover states, and responsive breakpoints work correctly.
- **Why**: Tailwind v4 changes class generation behavior. Visual regression testing ensures no design breakage.
- **Affected files**: None (visual inspection)
- **Dependencies**: Steps 19–21

---

### Phase 6: Prisma ORM upgrade

#### Step 23. Upgrade Prisma to latest 7.x

- **What to do**: Update `prisma`, `@prisma/client`, and `@prisma/adapter-pg` from `7.8.0` to latest 7.x. Update `@prisma/extension-accelerate` to latest. Run `pnpm install`. Run `pnpm db:generate` to regenerate the client.
- **Why**: Prisma 7.x point releases include bug fixes, performance improvements, and PostgreSQL driver enhancements.
- **Affected files**: `package.json`, `pnpm-lock.yaml`, `lib/generated/prisma/` (regenerated)
- **Dependencies**: Step 22

#### Step 24. Review Prisma schema for compatibility

- **What to do**: Compare `prisma/schema.prisma` against the latest Prisma 7.x schema reference. Check for deprecated field types, new required fields, or changed enum handling. Note: the schema uses `Unsupported("vector(768)")` and `Unsupported("tsvector")` — verify PostgreSQL provider compatibility.
- **Why**: Schema compatibility ensures migrations continue to work and the generated client is correct.
- **Affected files**: `prisma/schema.prisma`
- **Dependencies**: Step 23

#### Step 25. Update Prisma client imports

- **What to do**: Verify `lib/prisma.ts` imports from the custom output path (`lib/generated/prisma`) still work. Check that `@prisma/adapter-pg` and `@prisma/extension-accelerate` APIs haven't changed.
- **Why**: The custom output path and adapter pattern must remain functional.
- **Affected files**: `lib/prisma.ts`, `db/queries.ts`, `db/knowledge-queries.ts`, `db/types.ts`
- **Dependencies**: Step 23

#### Step 26. Run Prisma migrations and verify database connectivity

- **What to do**: Run `pnpm db:deploy` to apply any pending migrations. Verify the application can connect to PostgreSQL, read/write user data, knowledge sources, chat history, and embeddings.
- **Why**: The database layer must work correctly after the ORM upgrade.
- **Affected files**: None (database operation verification)
- **Dependencies**: Steps 24–25

---

### Phase 7: ESLint 8 → 9 migration

#### Step 27. Upgrade ESLint and related packages

- **What to do**: Update `eslint` from `^8.57.0` to `^9`. Update `eslint-config-next` to the matching Next.js version (from Phase 4). Update `eslint-config-prettier`, `eslint-plugin-tailwindcss`, `eslint-plugin-import`, `eslint-import-resolver-typescript` to ESLint 9-compatible versions. Run `pnpm install`.
- **Why**: ESLint 9 uses the new flat config format. The old `.eslintrc.json` format is deprecated.
- **Affected files**: `package.json`, `pnpm-lock.yaml`
- **Dependencies**: Step 22 (need stable Next.js and Tailwind before linting)

#### Step 28. Migrate to ESLint flat config

- **What to do**: Create `eslint.config.mjs` with the flat config equivalent of the existing `.eslintrc.json` rules. Delete `.eslintrc.json`. Configure `eslint-config-next` as a flat config import. Migrate the import plugin, tailwindcss plugin, and Prettier integration. Set `ignorePatterns` for `components/ui/**`.
- **Why**: ESLint 9 no longer supports `.eslintrc.json`. The flat config is the only format.
- **Affected files**: `+ eslint.config.mjs`, `- .eslintrc.json`
- **Dependencies**: Step 27

#### Step 29. Run lint and fix issues

- **What to do**: Run `pnpm lint`. Fix any new ESLint violations, misconfigured rules, or plugin compatibility issues. Ensure the import ordering rule (`import/order`) continues to work.
- **Why**: A clean lint pass ensures code quality standards are maintained.
- **Affected files**: Any file with lint errors
- **Dependencies**: Step 28

---

### Phase 8: Auth.js upgrade

#### Step 30. Upgrade next-auth to stable or latest beta

- **What to do**: Check if `next-auth@5` has a stable release. If stable exists, upgrade from `5.0.0-beta.31` to stable. If still beta, upgrade to the latest beta. Run `pnpm install`.
- **Why**: Beta versions may have security fixes or API changes. Moving to stable reduces long-term risk.
- **Affected files**: `package.json`, `pnpm-lock.yaml`
- **Dependencies**: Step 29

#### Step 31. Verify auth configuration compatibility

- **What to do**: Review the next-auth upgrade guide for any breaking changes between the current beta and the target version. Update `app/(auth)/auth.config.ts` if the config API changed. Update `middleware.ts` if the `NextAuth().auth` pattern changed.
- **Why**: Authentication is critical — a broken auth layer blocks all users.
- **Affected files**: `app/(auth)/auth.config.ts`, `middleware.ts`
- **Dependencies**: Step 30

#### Step 32. Smoke test authentication flows

- **What to do**: Manually test: (a) new user registration, (b) login with existing credentials, (c) logout, (d) protected route access, (e) admin route access, (f) session persistence across page navigations.
- **Why**: Auth.js v5 still in beta — API surface may have subtle changes.
- **Affected files**: None (manual testing)
- **Dependencies**: Step 31

---

### Phase 9: Remaining dependency upgrades and final validation

#### Step 33. Upgrade remaining tooling packages

- **What to do**: Upgrade `vitest` to latest 4.x (or 5.x if available and compatible), `postcss` to latest, `dotenv` to latest. Check for any new major versions of packages not yet upgraded.
- **Why**: Complete the dependency audit. No package should be left behind.
- **Affected files**: `package.json`, `pnpm-lock.yaml`, `vitest.config.ts` (if API changed)
- **Dependencies**: Step 32

#### Step 34. Update pnpm-workspace.yaml if needed

- **What to do**: Review the `allowBuilds` list in `pnpm-workspace.yaml`. Check if upgraded versions of `@google/genai`, `prisma`, `esbuild`, `sharp`, `protobufjs`, `unrs-resolver` still require allow-listing or if new native modules need to be added.
- **Why**: Native module builds can fail silently in CI without proper allow-listing.
- **Affected files**: `pnpm-workspace.yaml`
- **Dependencies**: Step 33

#### Step 35. Run full test suite

- **What to do**: Run `pnpm test` (vitest). Ensure all tests pass. If tests fail, diagnose whether the failure is due to a dependency API change or a genuine regression. Fix any test code that needs updating for new APIs.
- **Why**: Tests are the primary guard against regressions during the upgrade.
- **Affected files**: `tests/**/*.test.ts`, any source file with test failures
- **Dependencies**: Steps 23–34

#### Step 36. Run production build

- **What to do**: Run `pnpm build` (includes `prisma generate`, `prisma migrate deploy`, and `next build`). Fix any build errors. Verify the build output size hasn't regressed significantly.
- **Why**: A successful production build is the final gate before deployment.
- **Affected files**: Any file with build errors
- **Dependencies**: Step 35

#### Step 37. Update environment documentation

- **What to do**: Update `.env.example` with any new environment variables required by upgraded packages. Update `README.md` with updated version references and any breaking change notes.
- **Why**: Keeps developer onboarding accurate after the upgrade.
- **Affected files**: `.env.example`, `README.md`
- **Dependencies**: Step 36

---

### Phase 10: Deployment and monitoring

#### Step 38. Deploy to staging/preview

- **What to do**: Deploy the upgraded application to a staging or preview environment. Verify: (a) application starts without errors, (b) database connectivity works, (c) AI/chat responds correctly, (d) file uploads work, (e) authentication works.
- **Why**: Staging validation catches environment-specific issues before production.
- **Affected files**: None (deployment operation)
- **Dependencies**: Step 36

#### Step 39. Monitor production deployment

- **What to do**: Deploy to production. Monitor error logs, AI API latency, database query performance, and user-reported issues for 48 hours. Set up alerts for any spike in error rates.
- **Why**: Some issues only manifest under production load or with real user data.
- **Affected files**: None (monitoring)
- **Dependencies**: Step 38

#### Step 40. Tag the release and update plan status

- **What to do**: Create a git tag `post-upgrade`. Update this plan's header: set Status to `Implemented` and fill in the `Implemented` date.
- **Why**: Marks the upgrade as complete and provides a rollback reference point.
- **Affected files**: `plans/framework-upgrade/PLAN.md` (header update)
- **Dependencies**: Step 39

---

## 7. Database Changes

No schema changes are required by the upgrades themselves. However:

- The Prisma client **must be regenerated** after upgrading `@prisma/client` and `prisma` (Step 23). Run `prisma generate` which outputs to `lib/generated/prisma/`.
- After regeneration, verify all database queries (`db/queries.ts`, `db/knowledge-queries.ts`) still compile against the new client types.
- If `prisma migrate deploy` detects a drift due to a Prisma version change in migration checksums, run `prisma migrate dev` to reconcile (only in development; production uses `prisma migrate deploy`).
- The `Unsupported("vector(768)")` and `Unsupported("tsvector")` fields on `KnowledgeChunk` rely on the PostgreSQL provider's handling of unsupported types. Verify this still works after the Prisma upgrade.

---

## 8. Backend Changes

| Layer | Files | Changes Required |
|-------|-------|-----------------|
| AI Model Factory | `ai/index.ts` | Migrate `createGoogleGenerativeAI` and `wrapLanguageModel` to AI SDK v4 API |
| AI Middleware | `ai/custom-middleware.ts` | Update `Experimental_LanguageModelV1Middleware` import and type |
| AI Structured Gen | `ai/actions.ts` | Migrate `generateObject`/`streamObject` to v4 API |
| AI Knowledge Tools | `ai/knowledge-tools.ts` | Migrate `tool()` definitions to v4 API |
| AI Prompts | `ai/prompts/` | Verify prompt format compatibility with v4 |
| Chat API Route | `app/(chat)/api/chat/route.ts` | Migrate `streamText` and tool execution to v4 |
| AI Settings | `lib/ai-settings.ts` | Verify Google provider configuration for v4 |
| Auth Config | `app/(auth)/auth.config.ts` | Update for next-auth version changes if any |
| Middleware | `middleware.ts` | Verify `NextAuth().auth` pattern after upgrade |
| Prisma Client | `lib/prisma.ts` | Verify import path and adapter after regeneration |
| DB Queries | `db/queries.ts`, `db/knowledge-queries.ts` | Fix any type errors after Prisma client regeneration |
| Knowledge Lib | `lib/knowledge/` | Verify embedding, chunking, and retrieval utilities after AI SDK upgrade |

---

## 9. Frontend Changes

| Layer | Files | Changes Required |
|-------|-------|-----------------|
| Global CSS | `app/globals.css` | Migrate Tailwind directives to v4 `@import "tailwindcss"`; migrate theme to `@theme` blocks |
| Root Layout | `app/layout.tsx` | Verify geist font import works with upgraded packages |
| Tailwind Config | `tailwind.config.ts` | Significantly reduce or remove; move config to CSS |
| PostCSS Config | `postcss.config.mjs` | Update Tailwind plugin for v4 |
| shadcn/ui Config | `components.json` | Update for Tailwind v4 compatibility |
| UI Components | `components/ui/*.tsx` | Regenerate or patch for Tailwind v4 class changes |
| Custom Components | `components/custom/*.tsx` | Fix any React 19.x or Tailwind v4 deprecation warnings |
| Knowledge Components | `components/knowledge/*.tsx` | Verify compatibility with upgraded dependencies |
| Settings Components | `components/settings/*.tsx` | Verify compatibility with upgraded dependencies |
| Flight Components | `components/flights/*.tsx` | Verify compatibility (legacy feature, may be removed later) |

---

## 10. Validation Rules

After each phase, run these checks before proceeding to the next phase:

| Check | Command / Method | Expected Result |
|-------|-----------------|-----------------|
| TypeScript compilation | `pnpm typecheck` | Zero errors |
| Linting | `pnpm lint` | Zero errors, zero warnings |
| Test suite | `pnpm test` | All tests pass |
| Production build | `pnpm build` | Successful build, no errors |
| Dev server startup | `pnpm dev` | Server starts without errors |
| Database connectivity | Manual: login and view chat history | Chat history loads from DB |
| AI response | Manual: send a chat message | Streaming response with tool calls |
| Authentication | Manual: register, login, logout | All flows work |
| Knowledge retrieval | Manual: ask a company-knowledge question | Tool calls fire, citations appear |
| File upload | Manual: upload a file to knowledge | Upload succeeds, ingestion starts |
| Light/Dark mode | Manual: toggle theme | Theme switches correctly |
| Responsive layout | Manual: resize browser | Layout adapts correctly |

---

## 11. Security Considerations

- **npm audit**: Run `pnpm audit` after each phase. Fix any critical or high-severity vulnerabilities. Do not proceed to the next phase with unresolved critical advisories.
- **Auth secret integrity**: The `AUTH_SECRET` environment variable is used as the encryption key for the stored Gemini API key (`lib/ai-settings.ts`). Changing the auth configuration must not break this encryption chain. Test Gemini API key retrieval after the auth upgrade.
- **API key encryption**: The `encryptSecret`/`decryptSecret` functions use AES-256-GCM. Node.js crypto API is stable across versions, but verify encryption/decryption works after the Node.js and TypeScript upgrades.
- **Environment variable audit**: New versions of packages may introduce new required environment variables. Review every package's changelog for new `process.env` dependencies. Do not leak API keys in build output or client bundles.
- **Dependency integrity**: Verify `pnpm-lock.yaml` is regenerated cleanly. Ensure no malicious packages are introduced via transitive dependency upgrades.
- **CSRF / Middleware**: `middleware.ts` uses `NextAuth(authConfig).auth`. Verify this still blocks unauthenticated access to protected routes after the next-auth upgrade.

---

## 12. Testing Plan

### Unit Tests (vitest)
- Run existing tests: `pnpm test`
- Add tests for any new API patterns introduced by AI SDK v4 (tool definitions, model creation)
- Add tests for Tailwind v4 CSS theme token correctness (if snapshot testing for CSS)
- Add tests for Prisma client query type compatibility

### Integration Tests
- Chat API route: POST to `/api/chat` with a simple message, verify streaming response
- Knowledge API routes: Verify CRUD operations on knowledge sources
- Auth API routes: Verify login/session endpoints

### E2E / Manual QA Checklist
- [ ] Register a new user account
- [ ] Log in with the new account
- [ ] Send a chat message and receive a streaming response
- [ ] Ask a company knowledge question and verify tool calls + citations
- [ ] Upload a file to the knowledge base
- [ ] Approve a knowledge source (admin)
- [ ] Toggle between light and dark mode
- [ ] Navigate all admin pages (knowledge, AI settings, system settings)
- [ ] Test on mobile viewport
- [ ] Test on Chrome, Firefox, Safari

---

## 13. Rollback Plan

### Per-phase rollback

Each phase begins with a git checkpoint. If a phase fails:

1. Revert to the previous phase's git commit: `git checkout <phase-N-tag>`
2. Run `pnpm install` to restore previous `node_modules`
3. Run `pnpm build` to verify the previous state still builds
4. Diagnose the failure and re-attempt

### Full rollback to pre-upgrade state

If the entire upgrade must be abandoned:

1. `git checkout pre-upgrade` (or the tag created in Step 1)
2. `pnpm install`
3. `pnpm build`
4. `pnpm test`
5. Deploy the pre-upgrade state

### Database rollback considerations

- The Prisma upgrade may change migration checksums but should not require new migrations for existing models.
- If a migration was accidentally created during the upgrade, use `prisma migrate resolve --rolled-back <migration-name>` in development or restore from a database backup in production.
- No destructive database changes are expected. The schema (tables, columns, enums, indexes) remains unchanged.

### Prisma client rollback

- If `prisma generate` produces an incompatible client, delete `lib/generated/prisma/`, revert to the previous Prisma version, and re-run `prisma generate`.

---

## 14. Final Checklist

- [x] Plan reviewed and approved
- [x] Phase 1: Patch and minor upgrades complete (Steps 1–4)
- [x] Phase 2: TypeScript + @types/node upgraded (Steps 5–6)
- [x] Phase 3: AI SDK v3 → v7 migrated (Steps 7–14)
- [x] Phase 4: Next.js + React upgraded (Steps 15–17)
- [x] Phase 5: Tailwind CSS v3 → v4 migrated (Steps 18–22)
- [x] Phase 6: Prisma current version verified and client regenerated (Steps 23–26)
- [x] Phase 7: ESLint 8 → 9 migrated (Steps 27–29)
- [x] Phase 8: next-auth current beta verified (Steps 30–32)
- [x] Phase 9: Remaining deps upgraded, tests + build pass (Steps 33–37)
- [ ] Phase 10: Deployed and monitored (Steps 38–40)
- [x] All open decisions resolved
- [x] `pnpm typecheck` passes with zero errors
- [x] `pnpm lint` passes with zero errors
- [x] `pnpm test` passes
- [x] `pnpm build` succeeds
- [ ] Manual QA passed on all critical flows
- [ ] Staging deployment validated
- [ ] Production deployment validated
- [ ] 48-hour monitoring window passed with no regressions
- [ ] Post-upgrade git tag created
