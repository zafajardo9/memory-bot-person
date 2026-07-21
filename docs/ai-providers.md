# AI provider architecture

Chat is provider-neutral. Google Gemini and OpenAI implement the same adapter
contract, while the route, tools, persistence, and composer operate on provider
and model identifiers.

## Request flow

1. `/api/ai/selection` returns enabled providers and the chat-capable models
   accessible to their active credentials.
2. The user chooses a provider and model in the chat composer. The choice is
   stored in `UserAISelection`.
3. `/api/chat` authenticates and validates the request, then delegates to
   `ai/chat/stream-chat.ts`.
4. `resolveUserLanguageModel` validates the saved selection against the current
   model catalog and asks the registered adapter to create the language model.
5. The provider-neutral stream composes knowledge, weather, and demonstration
   flight tools and persists the finished conversation.

## Credentials and activation

Administrators manage connections at `/settings/ai`. A connection can use:

- a site-managed key encrypted with AES-256-GCM using `AUTH_SECRET`; or
- its adapter's environment-variable fallback.

Site-managed credentials take priority. Keys are tested through the provider's
model-list endpoint before they are saved. Only enabled providers are returned
to chat users, and ordinary-user catalog responses exclude credential metadata.

Model lists are cached for five minutes by provider and a one-way hash of the
active key. Saving or removing a provider key clears its cached list.

## Adding another provider

1. Add `ai/providers/<provider>.ts` implementing `AIProviderAdapter` from
   `ai/providers/types.ts`.
2. Create the provider's AI SDK language model in `createLanguageModel`.
3. Implement `listModels` using the provider's authenticated model-list API and
   mark models that support this application's chat workflow.
4. Register the adapter in `ai/providers/registry.ts`.
5. Add its optional fallback key to `.env.example` and add adapter/filter tests.

No chat route, database schema, settings layout, or model-selector change is
needed for another provider that satisfies the existing language-model contract.

## Knowledge embeddings

Knowledge retrieval currently uses Google's `gemini-embedding-2` independently
of the user's chat provider. This keeps the existing 768-dimensional pgvector
index stable. Adding a different embedding provider requires a deliberate index
migration or a separate embedding-capability abstraction; it should not be
coupled to the user's chat selection.
