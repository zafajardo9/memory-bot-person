# Company Knowledge Assistant

An authenticated, shared company notebook with an AI assistant that treats approved notes, files, and links as its primary source of truth. Every team member can capture and organize knowledge; administrators review and publish exactly what the assistant may retrieve. Chat uses explicit knowledge-search and source-reading tools, presents citations, and separates optional general AI guidance from company policy.

The original weather and demonstration flight-booking tools remain available for explicit requests.

## Knowledge features

- Shared notes plus Markdown, TXT, PDF, DOCX, and public URL sources
- Workspace-wide contribution with creator ownership and administrator publishing
- Bounded same-origin web crawling with SSRF and redirect protection
- Immutable source versions, duplicate detection, rescanning, approval, archival, and audit events
- Persistent ingestion jobs with progress and failure details
- Structure-aware chunking that preserves headings, pages, and source URLs
- Gemini `gemini-embedding-2` embeddings with 768 dimensions
- Hybrid PostgreSQL full-text and pgvector retrieval
- `searchCompanyKnowledge`, `readCompanyKnowledge`, and `listCompanyKnowledgeSources` AI tools
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

- Node.js 22.13 or newer
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
KNOWLEDGE_MAX_SOURCES=250
KNOWLEDGE_MAX_CONTEXT_TOKENS=1000000
```

`POSTGRES_URL` may be a direct `postgres://`/`postgresql://` URL or a Prisma Accelerate `prisma+postgres://` URL. Direct URLs use the Prisma `pg` adapter; Accelerate URLs use the Prisma Accelerate client extension. When Accelerate is used, set `DIRECT_DATABASE_URL` to the database's direct connection string for migration commands.

`ADMIN_EMAILS` is a comma-separated bootstrap allowlist and must be configured before a new deployment is made public. Only allowlisted accounts become administrators. Existing allowlisted accounts are promoted the next time they sign in.

Administrators may configure, test, activate, and rotate Google Gemini and OpenAI connections at `/settings/ai`. The application discovers the chat-capable models available to each credential and lets the administrator choose a default. Site-managed keys are encrypted with AES-256-GCM using `AUTH_SECRET` and take priority over `GOOGLE_GENERATIVE_AI_API_KEY` or `OPENAI_API_KEY`. Environment variables remain useful for initial setup.

Each user can choose an enabled provider and accessible model directly above the chat composer. Their selection is stored per account. Adding another provider requires one adapter in `ai/providers` and one registry entry; chat orchestration and the UI consume the shared provider contract.

Set `AUTH_TRUST_HOST=true` for production only when requests pass through a trusted deployment proxy or platform, such as the intended Vercel deployment. Development automatically trusts localhost.

Keep `KNOWLEDGE_ALLOW_LOCAL_EMBEDDINGS=false` in production. In non-production environments the application can fall back to deterministic local embeddings so ingestion remains testable, but Gemini embeddings provide the intended retrieval quality.

`KNOWLEDGE_MAX_SOURCES` limits active workspace sources. `KNOWLEDGE_MAX_CONTEXT_TOKENS` limits the indexed tokens across ready and approved, non-archived knowledge. The Notebook shows both values as live capacity; archiving or deleting a source releases its allocation.

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
   not run migrations or require a live database connection.

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
ai/
  chat/                    Provider-neutral streaming orchestration
  providers/               Provider adapters, registry, credentials, and model catalog
  tools/                   Weather, flight, and knowledge tool composition
  knowledge-tools.ts       Search/read/list tool definitions
  prompts/                 Source-first company assistant contract
components/
  knowledge/               Shared notebook and citation interfaces
db/
  queries.ts               Prisma user/chat/reservation persistence
  knowledge-queries.ts     Knowledge lifecycle persistence
lib/
  knowledge/               Extraction, security, chunking, embeddings, retrieval
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

## Data lifecycle

- A `KnowledgeSource` is the stable identity for a note, file, or URL.
- Each scan creates an immutable `KnowledgeSourceVersion`.
- Only the current `APPROVED` version is searchable.
- `KnowledgeChunk` stores citation metadata, full-text indexes, and 768-dimensional vectors.
- `KnowledgeIngestionJob` records progress, retries, stages, and errors.
- `KnowledgeAuditEvent` records source-of-truth changes.
- `KnowledgeQueryLog` stores minimal retrieval telemetry and selected chunk IDs.

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
