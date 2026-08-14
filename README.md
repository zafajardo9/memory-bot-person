# Company Knowledge Assistant

An authenticated, shared company notebook with an AI assistant that treats approved notes, files, and links as its primary source of truth. Every team member can capture and organize knowledge; administrators review and publish exactly what the assistant may retrieve. Chat uses explicit knowledge-search and source-reading tools, presents citations, and separates optional general AI guidance from company policy.

The original weather and demonstration flight-booking tools remain available for explicit requests, joined by a safe calculator and recency-aware web search.

## Knowledge features

- Shared notes plus Markdown, TXT, PDF, DOCX, and public URL sources
- Workspace-wide contribution with creator ownership and administrator publishing
- Bounded same-origin web crawling with SSRF and redirect protection
- Immutable source versions, duplicate detection, rescanning, approval, archival, and audit events
- Persistent ingestion jobs with progress and failure details
- Structure-aware chunking that preserves headings, pages, and source URLs
- Gemini `gemini-embedding-2` embeddings with 768 dimensions
- Hybrid PostgreSQL full-text and pgvector retrieval
- `searchCompanyKnowledge`, `readCompanyKnowledge`, `listCompanyKnowledgeSources`, and `addKnowledgeNote` AI tools
- Optional tag and source-type filters on company search
- Approved-current-version filtering for every employee search
- Source excerpts and citations rendered directly in chat
- Clear no-evidence responses instead of invented company policy
- Development-only local embedding fallback when Gemini credentials are unavailable

## Application features

- Streaming multi-provider chat with per-user provider and model selection
- Email/password authentication with Auth.js and bcrypt
- Admin/member roles controlled by an explicit administrator allowlist
- User-scoped persistent chat history
- Prisma ORM 7 with direct PostgreSQL and Prisma Accelerate URL support
- Admin-configurable Google Gemini and OpenAI connections encrypted in PostgreSQL, with environment fallbacks
- Live model discovery limited to the chat-capable models accessible to each credential
- Chat attachments through Vercel Blob
- Provider-neutral web research with Tavily, direct URL citations, safe page
  extraction, per-user daily quotas, recency and domain filters, and basic/advanced depth
- Optional read-only JavaScript-rendered page fallback through Vercel Labs
  Agent Browser, with isolated sessions and same-domain containment
- A safe calculator tool (arithmetic, percentages, unit and live currency
  conversion) and location-aware weather lookups
- Private persistent user memory with conversational save/list/delete tools and
  middleware-based recall
- Per-user agent profiles for display name, mood, answer length, custom behavior,
  and visual memory management at `/settings/agent`
- Private per-user chat skills: reusable one-turn instructions called with
  `/command your request` from the composer
- Optional structured automatic memory extraction from completed turns
- Responsive light and dark themes

## Tech stack

- Next.js 16, React 19, TypeScript 5.9, and pnpm 11
- Vercel AI SDK 7 with Google Gemini and OpenAI adapters
- Prisma ORM 7, Prisma Accelerate support, PostgreSQL, and pgvector
- Auth.js / NextAuth 5 beta
- Tailwind CSS 4, shadcn/ui, Radix UI, SWR, and Streamdown
- Mammoth, pdf-parse, and Cheerio for knowledge extraction
- Vitest for knowledge pipeline tests

## Grounding behavior

For questions about work, policies, responsibilities, procedures, or company operations, the assistant is instructed to:

1. Call `searchCompanyKnowledge` against approved sources.
2. Call `readCompanyKnowledge` when surrounding context is needed.
3. Answer from company evidence and cite each company-specific claim.
4. Surface source conflicts rather than silently choosing one.
5. Say when approved knowledge does not contain the answer.
6. Put non-company suggestions under **Additional general guidance**.

Knowledge text is treated as untrusted reference data, so instructions embedded inside uploaded documents do not replace the assistant's system rules.

## Prerequisites

- Node.js 24 or newer
- pnpm
- A PostgreSQL or Prisma Postgres database with pgvector support
- A Google Gemini or OpenAI API key for chat; Gemini is used for production knowledge embeddings
- A Vercel Blob token if ordinary chat attachments are enabled

## Environment variables

Copy `.env.example` to `.env.local` and replace every placeholder:

```bash
AUTH_SECRET="replace-with-a-random-secret"
AUTH_TRUST_HOST=true
ADMIN_EMAILS="admin@company.com"
GOOGLE_GENERATIVE_AI_API_KEY="your-google-ai-api-key"
OPENAI_API_KEY="your-openai-api-key"
POSTGRES_URL="prisma+postgres://..."
# Recommended when POSTGRES_URL is an Accelerate URL:
DIRECT_DATABASE_URL="postgresql://..."
BLOB_READ_WRITE_TOKEN="your-vercel-blob-token"

KNOWLEDGE_MANAGEMENT_ENABLED=true
KNOWLEDGE_INDEXING_ENABLED=true
KNOWLEDGE_CHAT_ENABLED=true
KNOWLEDGE_ALLOW_LOCAL_EMBEDDINGS=false
# Optional explicit caps; omit (or set to 0/unlimited) for unlimited knowledge.
# KNOWLEDGE_MAX_SOURCES=250
# KNOWLEDGE_MAX_CONTEXT_TOKENS=1000000

WEB_SEARCH_ENABLED=false
TAVILY_API_KEY="your-tavily-api-key"
WEB_SEARCH_MAX_DAILY=100
WEB_PAGE_MAX_CHARACTERS=12000
AGENT_BROWSER_ENABLED=false
AGENT_BROWSER_BINARY_PATH=""

USER_MEMORY_ENABLED=true
USER_MEMORY_MAX_ENTRIES=200
USER_MEMORY_CACHE_TTL_MS=30000
AUTO_MEMORY_ENABLED=false
CHAT_SKILLS_ENABLED=true
```

`POSTGRES_URL` may be a direct `postgres://`/`postgresql://` URL or a Prisma Accelerate `prisma+postgres://` URL. Direct URLs use the Prisma `pg` adapter; Accelerate URLs use the Prisma Accelerate client extension. When Accelerate is used, set `DIRECT_DATABASE_URL` to the database's direct connection string for migration commands.

`ADMIN_EMAILS` is a comma-separated bootstrap allowlist and must be configured before a new deployment is made public. Only allowlisted accounts become administrators. Existing allowlisted accounts are promoted the next time they sign in.

Administrators may configure, test, activate, and rotate AI provider connections at `/settings/ai`. The application discovers the chat-capable models available to each credential and lets administrators assign workspace-wide research/tool-calling and knowledge-embedding roles. Site-managed keys are encrypted with AES-256-GCM using `AUTH_SECRET` and take priority over provider environment keys. Environment variables remain useful for initial setup.

The chat composer intentionally contains no provider or model picker. It shows the workspace Thinking provider as read-only status and offers a Humanizer toggle. Thinking runs tools and gathers evidence; Humanizer routes the final visible answer through the workspace end processor for clearer, more natural language. Google is the default Thinking provider until an administrator saves another workspace role. Adding another provider requires one adapter in `ai/providers` and one registry entry; chat orchestration and the UI consume the shared provider contract.

Each user can also tune their private agent at `/settings/agent`. The saved
name appears in chat, while the mood, answer-length, and custom-behavior
preferences are applied to every model response without overriding safety,
privacy, tool-use, or company-source rules. The same page lets users inspect,
add, and delete their own persistent memories.

Set `AUTH_TRUST_HOST=true` for production only when requests pass through a trusted deployment proxy or platform, such as the intended Vercel deployment. Development automatically trusts localhost.

Keep `KNOWLEDGE_ALLOW_LOCAL_EMBEDDINGS=false` in production. In non-production environments the application can fall back to deterministic local embeddings so ingestion remains testable, but Gemini embeddings provide the intended retrieval quality.

Knowledge-bank storage is unlimited by default: anyone can keep adding notes, files, and links without hitting an application-level source or indexed-token ceiling. This is independent from a model's finite chat context: each turn retrieves only a bounded set of relevant passages, and a new conversation resets chat history without removing Notebook knowledge. To impose an explicit storage cap, set `KNOWLEDGE_MAX_SOURCES` (active workspace sources) and/or `KNOWLEDGE_MAX_CONTEXT_TOKENS` (indexed tokens across ready and approved, non-archived knowledge) to a positive integer; set them to `0` or `unlimited` to restore unlimited storage. The Notebook shows live indexed usage and switches to “Unlimited” when no cap is set; archiving or deleting a source releases its allocation.

Set `WEB_SEARCH_ENABLED=true` and configure `TAVILY_API_KEY` to expose
`webSearch` and `readWebPage`. Search usage is limited per user and UTC day by
`WEB_SEARCH_MAX_DAILY`; page text returned to the model is capped by
`WEB_PAGE_MAX_CHARACTERS`. Public page reads reuse the knowledge system's DNS,
redirect, port, timeout, and response-size protections.

Web research is consent-gated per turn. The assistant starts with the approved
Notebook and asks before using public-web sources unless the user directly
requested web research. After approval, the final response separates Notebook
findings, current web findings, and a cited comparison of agreements, additions,
gaps, and conflicts.

Agent Browser is a secondary reader for public pages that require JavaScript
rendering. It is never exposed as an unrestricted automation shell: chat can
only provide a public URL, open it in a fresh isolated headless session, extract
readable content, and close the session. Each request reuses the existing web
quota and applies public-URL validation, domain containment, content boundary
markers, and output limits. It cannot click, type, upload, reuse browser
profiles, authenticate, or execute arbitrary JavaScript.

Install its pinned native CLI and Chrome-for-Testing runtime once:

```bash
pnpm install
pnpm agent-browser:install
pnpm agent-browser:doctor
```

Local development enables the integration automatically when the native binary
is present. Production requires `AGENT_BROWSER_ENABLED=true`. Standard Vercel
serverless functions are not a suitable host for the long-lived Chrome child
process; use a container or persistent compute service and optionally set
`AGENT_BROWSER_BINARY_PATH` when the binary is managed outside `node_modules`.

`USER_MEMORY_ENABLED` exposes private, user-scoped save, list, and delete tools
and injects the top memories before every model step. `AUTO_MEMORY_ENABLED` is
intentionally opt-in because it adds a structured model call after each
completed chat turn. Automatic extraction stores only high-confidence,
non-sensitive durable context. `USER_MEMORY_MAX_ENTRIES` defaults to 200.

Chat skills are private instruction templates managed from the **Skills** tab in
an agent's settings. Type `/` at the start of a chat message to open the skill
picker, or call one directly with `/slug your request`. The server resolves only
enabled skills owned by the signed-in user, removes the command before sending
the request to the model, and applies the escaped instructions for that turn.
Unknown or disabled commands remain ordinary message text. Skills are available
by default; set `CHAT_SKILLS_ENABLED=false` for an emergency rollback.

Never commit `.env.local`. Generate an Auth.js secret with `openssl rand -base64 32`.

## Run locally

```bash
pnpm install
pnpm db:generate
pnpm db:deploy
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000), register the first account, and visit [http://localhost:3000/knowledge](http://localhost:3000/knowledge).

## Deploy to Vercel

1. Add the environment variables listed above to the Vercel project. Set them
   separately for Production and Preview as appropriate. Do not expose a new
   deployment until `AUTH_SECRET`, `ADMIN_EMAILS`, and `POSTGRES_URL` are set.
2. Apply pending schema changes from a trusted machine or CI job with database
   network access:

   ```bash
   pnpm install --frozen-lockfile
   pnpm db:deploy
   ```

3. Deploy with Vercel's default `pnpm build` command. The application build does
   not run migrations or require a live database connection. It validates that
   `AUTH_SECRET` and `POSTGRES_URL` are present before compiling, so a deployment
   with broken authentication cannot be published accidentally.

Use `DIRECT_DATABASE_URL` for migration commands when the runtime
`POSTGRES_URL` points to Prisma Accelerate. Apply migrations once before routing
production traffic to a release. Do not run migrations concurrently from every
Vercel build or Preview deployment.

### Component inspector

Development builds include the Xray component inspector. Press `Cmd+Shift+X`
(or use its floating button), hover over an element to see its React component and
source path, then click to open that source in VS Code. Restart `pnpm dev` after
changing `next.config.mjs`. The inspector and its source markers are disabled in
production builds.

To publish knowledge:

1. Write a note, upload a supported file, or enter a public URL.
2. Wait for the deep scan to reach `ready_for_approval`.
3. Open the source to inspect extracted text and version history.
4. Approve the ready version.
5. Ask a work-related question in chat and inspect the cited passages.

## Commands

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Start the Turbopack development server. |
| `pnpm build` | Generate Prisma Client and build Next.js without connecting to the database. |
| `pnpm start` | Serve a production build. |
| `pnpm lint` | Run ESLint 9 with the flat project configuration. |
| `pnpm typecheck` | Run TypeScript without emitting files. |
| `pnpm test` | Run the Vitest suite. |
| `pnpm agent-browser:install` | Download Agent Browser's Chrome-for-Testing runtime. |
| `pnpm agent-browser:doctor` | Verify the Agent Browser CLI, Chrome, and launch environment. |
| `pnpm db:generate` | Generate Prisma Client. |
| `pnpm db:migrate` | Create/apply a development migration. |
| `pnpm db:deploy` | Apply checked-in migrations. |
| `pnpm db:studio` | Open Prisma Studio. |
| `pnpm verify:knowledge` | Create, index, approve, retrieve, and remove temporary smoke-test knowledge. |

## Project structure

```text
app/
  (admin)/knowledge/       Authenticated shared notebook and source previews
  (auth)/                  Auth.js configuration and account flows
  (chat)/api/knowledge/    Knowledge management and job APIs
  (chat)/api/ai/           Provider configuration, model discovery, and user selection
  (chat)/api/chat/         Thin streaming chat endpoint
  (chat)/settings/agent/   Per-user agent and memory settings
ai/
  chat/                    Research-to-writer streaming orchestration and fallback
  providers/               Provider adapters, role settings, credentials, and model catalog
  memory/                  Structured automatic memory extraction
  tools/                   Knowledge, web, browser, memory, weather, and flight tools
  knowledge-tools.ts       Search/read/list tool definitions
  prompts/                 Source-first company assistant contract
components/
  custom/skill-picker.tsx  Slash-command skill discovery in the chat composer
  knowledge/               Shared notebook and citation interfaces
  settings/                Agent and provider settings interfaces
db/
  agent-settings-queries.ts Per-user agent profile persistence
  queries.ts               Prisma user/chat/reservation persistence
  knowledge-queries.ts     Knowledge lifecycle persistence
  memory-queries.ts        User-scoped memory persistence
  skill-queries.ts         User-scoped chat skill CRUD and usage tracking
lib/
  knowledge/               Extraction, security, chunking, embeddings, retrieval
  memory/                  Feature flags, cache, and prompt preflight
  agent-settings.ts        Agent profile validation, defaults, and prompt formatting
  skills.ts                Chat skill validation, slash parsing, and prompt boundaries
  web/                     Tavily registry, quota, and safe page extraction
  prisma.ts                Direct PostgreSQL and Accelerate client selection
prisma/
  schema.prisma            Complete application and knowledge data model
  migrations/              Prisma SQL migrations, including pgvector
tests/unit/knowledge/      Pipeline and URL-security tests
scripts/verify-knowledge.ts
```

## Knowledge API

All routes require authentication. Members may list and contribute sources and manage their own contributions. Administrator access is required to publish any version as authoritative; administrators may manage every source.

| Route | Methods | Purpose |
| --- | --- | --- |
| `/api/knowledge` | `GET`, `POST` | List sources or add a note, file, or link. |
| `/api/knowledge/:id` | `GET`, `PATCH`, `DELETE` | Inspect, archive, or delete a source. |
| `/api/knowledge/:id/approve` | `POST` | Publish a ready version as authoritative. |
| `/api/knowledge/:id/rescan` | `POST` | Create and process a new immutable version. |
| `/api/knowledge-jobs/:id` | `GET` | Read persisted ingestion progress. |
| `/api/ai/providers` | `GET` | List registered provider configuration status. |
| `/api/ai/providers/:id` | `GET`, `POST`, `PUT`, `DELETE` | Inspect, test, save, activate, or remove a provider connection (admin only). |
| `/api/ai/providers/:id/models` | `GET` | Discover chat-capable models accessible to a provider credential. |
| `/api/ai/selection` | `GET`, `PUT` | Read the provider catalog or save the current user's provider/model choice. |
| `/api/ai/workspace` | `GET`, `PUT` | Read or save workspace Thinking and Humanizer models (admin only). |
| `/api/ai/runtime` | `GET` | Read safe Thinking/Humanizer availability for the authenticated chat composer. |
| `/api/ai/skills` | `GET`, `POST` | List or create the signed-in user's chat skills. |
| `/api/ai/skills/:id` | `PATCH`, `DELETE` | Update or delete an owned chat skill. |
| `/api/ai/knowledge` | `GET`, `PUT` | Read or save the workspace knowledge-embedding model (admin only). |

## Data lifecycle

- A `KnowledgeSource` is the stable identity for a note, file, or URL.
- Each scan creates an immutable `KnowledgeSourceVersion`.
- Only the current `APPROVED` version is searchable.
- `KnowledgeChunk` stores citation metadata, full-text indexes, and 768-dimensional vectors.
- `KnowledgeIngestionJob` records progress, retries, stages, and errors.
- `KnowledgeAuditEvent` records source-of-truth changes.
- `KnowledgeQueryLog` stores minimal retrieval telemetry and selected chunk IDs.
- `UserMemory` stores private durable context and is deleted with its owning
  user.
- `UserAgentSettings` stores one optional private response profile per user.
- `WebSearchUsage` enforces the per-user UTC-day search allowance.

Original knowledge files are stored privately in PostgreSQL rather than exposed through public Blob URLs. Ordinary chat attachments continue to use Vercel Blob.

See [AI provider architecture](docs/ai-providers.md), [Knowledge administration](docs/knowledge-administration.md), and the original [implementation plan](plans/company-knowledge-base/PLAN.md) for deeper operational and architectural detail.

## Important limitations

- Scanned/image-only PDF OCR is not included in this release.
- URL imports support public HTTP/HTTPS content only and cannot access authenticated sites.
- Crawls are restricted to the submitted origin, two levels, and twenty pages.
- At least one enabled provider must have a valid credential for production chat. Google credentials remain necessary for high-quality knowledge embeddings.
- Review and approval by a company subject-matter expert is required before treating a source as authoritative.

## License

Licensed under the [Apache License 2.0](LICENSE).
