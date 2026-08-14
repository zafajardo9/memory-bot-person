# AI provider architecture

The application assigns providers by role. Provider credentials, adapters, and
model discovery are shared, but chat answering, research/tool calling, and
knowledge embeddings are resolved independently.

## Provider roles

- **Thinking & tool calling** — selected once for the workspace by an
  administrator. This model runs the evidence-gathering loop and tools. Google
  is the default while the workspace role is unset. Only models marked
  `toolCallingCapable` are eligible.
- **Humanizer / end processor** — an optional workspace model that receives the
  evidence transcript without tools and writes the visible final answer. The
  per-chat Humanizer toggle defaults on. If no end processor is configured, the
  Thinking model performs the same tool-free humanizing pass.
- **Knowledge embeddings** — selected once for the workspace and kept separate
  from both language-model roles so changing a chat model cannot invalidate the
  vector index.

## Chat request flow

1. `/api/ai/selection` returns enabled providers and the chat-capable models
   accessible to their active credentials.
2. `WorkspaceAIConfig` is resolved as the Thinking model. Before an admin saves
   a role, the connected Google default model is used. A hidden legacy
   user/agent selection is used only if workspace Thinking and Google are both
   unavailable.
3. The optional workspace Humanizer model is resolved when the request toggle
   is on.
4. When research is configured, `ai/chat/stream-chat.ts` runs a research stream
   with tools and a 10-step budget. Tool and source activity is relayed live,
   while the research model's internal narrative is hidden.
5. The research assistant/tool transcript is appended to the original model
   messages. The Humanizer model—or Thinking as its fallback—then streams the
   final answer without tools. When Humanizer is off, Thinking writes the final
   answer without the humanizing instruction.
6. When workspace Thinking is not available and Humanizer is off—or when
   `AI_RESEARCH_MODEL_ENABLED=false`—the legacy single-model 14-step path remains
   available as an emergency compatibility fallback.

The split path is enabled by default. The environment flag is an emergency
rollback switch, not a requirement for normal operation.

## Configuration and APIs

Administrators manage provider connections and both workspace roles at
`/settings/ai`.

- `/api/ai/workspace` (`GET`, `PUT`, admin only) reads or updates the workspace
  Thinking and Humanizer providers/models.
- `/api/ai/runtime` (`GET`, authenticated) returns only safe composer status:
  availability, Thinking provider label, and Humanizer availability.
- `/api/ai/knowledge` (`GET`, `PUT`, admin only) reads or updates the embedding
  provider/model.
- `/api/ai/selection` reads the user catalog and saves the user or agent chat
  selection.

`WorkspaceAIConfig` is a singleton row keyed by `workspace`, stores Thinking
plus optional Humanizer identifiers, and records the administrator who last
changed it. The chat composer does not expose provider or model selection.

## Credentials and activation

A connection can use a site-managed key encrypted with AES-256-GCM using
`AUTH_SECRET`, or its adapter's environment-variable fallback. Site-managed
credentials take priority. Only enabled, configured providers can be saved for
the research role, and every save is validated against the current model
catalog.

Model lists are cached for five minutes by provider and a one-way hash of the
active key. Saving or removing a provider key clears its cached list.

## Adding another provider

1. Add `ai/providers/<provider>.ts` implementing `AIProviderAdapter` from
   `ai/providers/types.ts`.
2. Create the provider's AI SDK language model in `createLanguageModel`.
3. Implement `listModels`, setting both `chatCapable` and
   `toolCallingCapable` accurately for every model.
4. Register the adapter in `ai/providers/registry.ts`.
5. Add its optional fallback key to `.env.example` and add adapter/filter tests.

No chat route, database schema, settings layout, or model-selector change is
needed for another provider that satisfies the shared adapter contract.
