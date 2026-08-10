# Knowledge Administration

## Contributing shared memory

1. Sign in with any workspace account.
2. Open `/knowledge`.
3. Write a note, upload Markdown, TXT, PDF, or DOCX up to 50 MB, or add a public HTTP/HTTPS URL.
4. For URLs, leave crawl depth at zero unless linked pages are also authoritative. Crawls never leave the submitted origin and stop at the configured page limit.
5. Wait for the persisted job to finish.

All contributions are visible in the shared team notebook. Contributors may delete their own sources and create new versions of their own notes or files. A contribution is not used as company truth until an administrator publishes it.

## Publishing a trusted source

1. Sign in with an account whose Prisma `User.role` is `ADMIN`.
2. Open the ready source and inspect its extracted text, page/section boundaries, and chunk count.
3. Select **Publish** only after confirming the content is current and safe for employees.

Draft, processing, failed, and archived versions are excluded from employee retrieval. Approval atomically replaces the previous current version.

## Updating knowledge

- Edit a note or use **Rescan** on a file or link to create a new immutable version.
- An unchanged scan is recorded but is not published as a duplicate version.
- Review and approve the new ready version explicitly.
- The previous approved version remains searchable until replacement approval succeeds.
- Use **Archive** to remove a source from retrieval immediately without deleting its history.
- Use **Delete** only when the source, versions, chunks, jobs, and stored original file should be removed.

## Answer interpretation

- “Memory consulted” cards show the exact retrieved excerpts.
- Inline citations identify the source and page or section supporting a company claim.
- “I couldn't find that in the approved company knowledge” means an administrator should add or update a source if the answer is expected to exist.
- “Additional general guidance” is model knowledge, not company policy.
- Conflicting approved sources should be corrected by archiving or replacing the stale source; the assistant is instructed to cite and surface both until resolved.

## Security operations

- Disable public registration before production company rollout unless every registrant is trusted.
- Maintain `ADMIN_EMAILS` as a narrow bootstrap list and remove departed administrators promptly.
- Rotate database, Gemini, Auth.js, and Blob credentials on a regular schedule and immediately after accidental disclosure.
- Keep original knowledge files private. They are stored in PostgreSQL and are not returned by list APIs.
- Review URL domains before enabling crawling. Local, private-network, credential-bearing, and nonstandard-port URLs are rejected.
- Treat extracted content as untrusted. Never approve a source solely because ingestion succeeded.
- Back up PostgreSQL before destructive migrations or large re-indexing work.

## Failure recovery

- Failed jobs retain a safe error message and can be retried with **Rescan**.
- If Gemini embeddings are unavailable in production, fix the API credential and rescan; production should not enable the local embedding fallback.
- If a new source is wrong, leave it unapproved or archive it.
- If an approved replacement is wrong, rescan/reapprove the correct document. Database restoration is the fallback for a physically deleted version.
- Feature flags can independently disable management, indexing, or knowledge chat while preserving stored data.

## Verification

Run these checks before deployment:

```bash
pnpm db:deploy
pnpm typecheck
pnpm test
pnpm lint
pnpm verify:knowledge
pnpm build
```

The smoke command creates temporary knowledge, indexes and approves it, verifies hybrid retrieval and citations, then deletes its temporary records.
