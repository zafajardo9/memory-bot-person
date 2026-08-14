import {
  BookOpen,
  Calculator,
  ChevronDown,
  CloudSun,
  Database,
  FileText,
  Globe,
  Lightbulb,
  MemoryStickIcon as Memory,
  MonitorCog,
  Plane,
  Search,
  Sparkles,
  Wrench,
} from "lucide-react";

import { auth } from "@/app/(auth)/auth";
import { IntegrationCredentialCard } from "@/components/settings/integration-credential-card";
import { getIntegrationCredentialStatus } from "@/lib/integrations/service";
import { isKnowledgeChatEnabled } from "@/lib/knowledge/config";
import { isAutoMemoryEnabled, isUserMemoryEnabled } from "@/lib/memory/config";
import { isAgentBrowserInstalled } from "@/lib/web/agent-browser";
import {
  isAgentBrowserEnabled,
  isWebSearchEnabled,
} from "@/lib/web/config";

interface ToolEntry {
  name: string;
  description: string;
  category: string;
  icon: React.ReactNode;
  enabled: boolean;
  note?: string;
}

interface Capability {
  id: string;
  title: string;
  description: string;
  examples: string[];
  tools: string[];
  enabled: boolean;
  note?: string;
  icon: React.ReactNode;
  accent: string;
}

function Status({ enabled }: { enabled: boolean }) {
  return enabled ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
      <span className="size-1.5 rounded-full bg-emerald-500" />
      Active
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
      <span className="size-1.5 rounded-full bg-muted-foreground/30" />
      Off
    </span>
  );
}

function CapabilityCard({ capability }: { capability: Capability }) {
  return (
    <div className="flex flex-col rounded-3xl border border-black/[0.06] bg-white/75 p-5 dark:border-white/[0.07] dark:bg-white/[0.045]">
      <div className="flex items-start justify-between gap-3">
        <span
          className={`flex size-9 shrink-0 items-center justify-center rounded-xl border ${capability.accent}`}
        >
          {capability.icon}
        </span>
        <Status enabled={capability.enabled} />
      </div>

      <h3 className="mt-3 text-sm font-semibold">{capability.title}</h3>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">
        {capability.description}
      </p>
      {capability.note ? (
        <p className="mt-2 rounded-lg bg-amber-500/10 px-2.5 py-1.5 text-[11px] leading-5 text-amber-700 dark:text-amber-300">
          {capability.note}
        </p>
      ) : null}

      <div className="mt-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Try asking
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {capability.examples.map((example) => (
            <code
              key={example}
              className="rounded-full border border-black/[0.06] bg-foreground/[0.03] px-2.5 py-1 text-[11px] text-foreground/80 dark:border-white/[0.07]"
            >
              {example}
            </code>
          ))}
        </div>
      </div>

      <p className="mt-auto pt-4 font-mono text-[10px] text-muted-foreground/60">
        Powered by: {capability.tools.join(" · ")}
      </p>
    </div>
  );
}

function SectionHeader({
  icon,
  title,
  description,
  accent,
  headingId,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  accent: string;
  headingId?: string;
}) {
  return (
    <div className="mb-3 flex items-start gap-3">
      <span
        className={`flex size-8 shrink-0 items-center justify-center rounded-lg border ${accent}`}
      >
        {icon}
      </span>
      <div className="min-w-0">
        <h2 id={headingId} className="text-sm font-semibold">
          {title}
        </h2>
        <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

export default async function ToolsPage() {
  const [session, tavilyStatus] = await Promise.all([
    auth(),
    getIntegrationCredentialStatus("tavily"),
  ]);
  const canConfigureCredentials = session?.user?.role === "ADMIN";
  const visibleTavilyStatus = canConfigureCredentials
    ? tavilyStatus
    : {
        ...tavilyStatus,
        maskedKey: null,
        updatedBy: null,
        source: tavilyStatus.configured ? ("SITE" as const) : ("NONE" as const),
      };
  const knowledgeOn = isKnowledgeChatEnabled();
  const publicWebOn = isWebSearchEnabled();
  const tavilySearchOn = publicWebOn && tavilyStatus.configured;
  const agentBrowserOn =
    isAgentBrowserEnabled() && isAgentBrowserInstalled();
  const memoryOn = isUserMemoryEnabled();
  const autoMemoryOn = isAutoMemoryEnabled();

  const violet = "border-violet-500/25 bg-violet-500/10 text-violet-600 dark:text-violet-300";
  const blue = "border-sky-500/25 bg-sky-500/10 text-sky-600 dark:text-sky-300";
  const emerald = "border-emerald-500/25 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300";
  const amber = "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300";

  const capabilitySections: {
    id: string;
    title: string;
    description: string;
    accent: string;
    icon: React.ReactNode;
    capabilities: Capability[];
    wide?: boolean;
  }[] = [
    {
      id: "notebook",
      title: "Your company Notebook",
      description:
        "Answers about the company, its processes, and projects come from approved, cited sources — never invented.",
      accent: violet,
      icon: <BookOpen size={14} />,
      capabilities: [
        {
          id: "notebook-search",
          title: "Answer from your Notebook",
          description:
            "Ask about company policy, procedures, responsibilities, or how things work. Every company claim is answered from an approved source and cited with 【title — section or page】.",
          examples: [
            "How do I submit an expense report?",
            "What's the policy on remote work?",
            "Who owns the onboarding checklist?",
            "Summarize our Q3 planning notes",
          ],
          tools: [
            "searchCompanyKnowledge",
            "readCompanyKnowledge",
            "listCompanyKnowledgeSources",
          ],
          enabled: knowledgeOn,
          icon: <Search size={16} />,
          accent: violet,
        },
        {
          id: "notebook-grow",
          title: "Grow the Notebook from chat",
          description:
            "Tell the assistant something worth remembering and it saves a draft note for review — no need to open /knowledge.",
          examples: [
            "Save a note: the on-call rotation moved to Thursdays",
            "Add to the notebook: our staging URL is staging.kairo.dev",
          ],
          tools: ["addKnowledgeNote"],
          enabled: knowledgeOn,
          note: !knowledgeOn
            ? "Knowledge chat is disabled."
            : "Administrators only · saved as a draft for review",
          icon: <Sparkles size={16} />,
          accent: violet,
        },
      ],
    },
    {
      id: "web",
      title: "The web",
      description:
        "Current, external information on demand — with source URLs and permission controls.",
      accent: blue,
      icon: <Globe size={14} />,
      capabilities: [
        {
          id: "web-search",
          title: "Search the web",
          description:
            "Get current news, prices, documentation, or comparisons. Ask for recency, and the assistant can narrow results to trusted domains.",
          examples: [
            "What's the latest news on AI chips this week?",
            "Compare current prices for an M4 MacBook",
            "Find results only from arxiv.org",
          ],
          tools: ["webSearch"],
          enabled: tavilySearchOn,
          note: !isWebSearchEnabled()
            ? "Web search is disabled by an administrator."
            : !tavilyStatus.configured
              ? "Add a Tavily API key below to enable live web search."
              : undefined,
          icon: <Globe size={16} />,
          accent: blue,
        },
        {
          id: "web-read",
          title: "Read any page",
          description:
            "Paste a public link and the assistant reads the page for you — to summarize it, quote it, or answer questions about it.",
          examples: [
            "Read this page: https://example.com/report",
            "Summarize the article at this link",
          ],
          tools: ["readWebPage", "browseWebPage"],
          enabled: publicWebOn,
          note: !publicWebOn
            ? "Page reading is disabled by an administrator."
            : undefined,
          icon: <FileText size={16} />,
          accent: blue,
        },
      ],
    },
    {
      id: "memory",
      title: "Knows you",
      description:
        "Private, per-user memory that persists across conversations.",
      accent: emerald,
      icon: <Memory size={14} />,
      wide: true,
      capabilities: [
        {
          id: "memory",
          title: "Remembers your preferences and facts",
          description:
            "The assistant recalls what you tell it — preferences, recurring context, personal facts — and applies it naturally in future chats. You can review, correct, or delete anything it remembers.",
          examples: [
            "Remember I prefer concise answers",
            "I'm usually available for meetings after 2pm",
            "What do you know about me?",
            "Forget that I prefer morning meetings",
          ],
          tools: [
            "saveUserMemory",
            "listUserMemory",
            "deleteUserMemory",
            "autoMemoryExtraction",
          ],
          enabled: memoryOn,
          note: !memoryOn
            ? "Personal memory is disabled."
            : !autoMemoryOn
              ? "Automatic extraction is off — memories are saved only when you explicitly ask or share them."
              : undefined,
          icon: <Memory size={16} />,
          accent: emerald,
        },
      ],
    },
    {
      id: "utilities",
      title: "Everyday utilities",
      description:
        "Small, reliable helpers the assistant reaches for automatically.",
      accent: amber,
      icon: <Wrench size={14} />,
      capabilities: [
        {
          id: "calculate",
          title: "Calculations & conversions",
          description:
            "Exact arithmetic, percentages, and unit or live currency conversions — the assistant never does math in its head.",
          examples: [
            "What's 15% of 250 plus the square root of 144?",
            "Convert 5 km to miles",
            "How much is 100 USD in EUR?",
          ],
          tools: ["calculate"],
          enabled: true,
          icon: <Calculator size={16} />,
          accent: amber,
        },
        {
          id: "weather",
          title: "Weather",
          description:
            "Current conditions and today's forecast for any place — just name a city.",
          examples: ["What's the weather in Tokyo?", "Will it rain in Manila today?"],
          tools: ["getWeather"],
          enabled: true,
          icon: <CloudSun size={16} />,
          accent: amber,
        },
        {
          id: "flights",
          title: "Flight demo",
          description:
            "A demonstration booking flow: search, seat selection, payment, and boarding pass.",
          examples: ["Search flights from Manila to Tokyo", "Show me the boarding pass demo"],
          tools: [
            "searchFlights",
            "selectSeats",
            "createReservation",
            "authorizePayment",
            "verifyPayment",
            "displayBoardingPass",
            "displayFlightStatus",
          ],
          enabled: true,
          icon: <Plane size={16} />,
          accent: amber,
        },
      ],
    },
  ];

  const toolGroups: { title: string; description: string; tools: ToolEntry[] }[] = [
    {
      title: "Company Knowledge",
      description: "Retrieval-augmented search across approved team knowledge.",
      tools: [
        {
          name: "searchCompanyKnowledge",
          description:
            "Hybrid search (vector + full-text) across approved, non-archived knowledge sources. Returns ranked chunks with citation metadata. Supports optional tag and source-type filters.",
          category: "Knowledge",
          icon: <Search size={14} />,
          enabled: knowledgeOn,
        },
        {
          name: "readCompanyKnowledge",
          description:
            "Expands surrounding passages for chunks returned by searchCompanyKnowledge. Includes neighbor chunks for deeper context.",
          category: "Knowledge",
          icon: <BookOpen size={14} />,
          enabled: knowledgeOn,
        },
        {
          name: "listCompanyKnowledgeSources",
          description: "Lists all approved knowledge sources with title, type, and tags.",
          category: "Knowledge",
          icon: <Database size={14} />,
          enabled: knowledgeOn,
        },
        {
          name: "addKnowledgeNote",
          description:
            "Saves a note into the Notebook as a draft for administrator review. Administrator-only; publishes on the /knowledge page.",
          category: "Knowledge",
          icon: <Sparkles size={14} />,
          enabled: knowledgeOn,
          note: "Admins only · saved as draft for review",
        },
      ],
    },
    {
      title: "Web Search",
      description: "Live web search and page reading for current information.",
      tools: [
        {
          name: "webSearch",
          description:
            "Searches the public web via Tavily API. Returns clean markdown results with source URLs. Supports recency filters (timeRange), domain allow/deny lists, and basic/advanced depth. Results are untrusted and supplementary to company knowledge.",
          category: "Web",
          icon: <Globe size={14} />,
          enabled: tavilySearchOn,
          note: !isWebSearchEnabled()
            ? "WEB_SEARCH_ENABLED is false"
            : !tavilyStatus.configured
              ? "Add a Tavily API key below"
              : undefined,
        },
        {
          name: "readWebPage",
          description:
            "Fetches and extracts text from a public URL. Used when web search snippets are insufficient. SSRF-protected.",
          category: "Web",
          icon: <FileText size={14} />,
          enabled: publicWebOn,
          note: !publicWebOn
            ? "WEB_SEARCH_ENABLED is false"
            : "Automatically reads public links shared in chat",
        },
        {
          name: "browseWebPage",
          description:
            "Secondary rendered-page reader powered by Vercel Labs Agent Browser. Uses an isolated headless Chrome session only when JavaScript prevents ordinary page extraction.",
          category: "Browser",
          icon: <MonitorCog size={14} />,
          enabled: agentBrowserOn,
          note: !isAgentBrowserEnabled()
            ? "AGENT_BROWSER_ENABLED is false"
            : !isAgentBrowserInstalled()
              ? "Run pnpm agent-browser:install"
              : "Read-only · isolated session · same-domain containment",
        },
      ],
    },
    {
      title: "User Memory",
      description: "Durable personal memory that persists across conversations.",
      tools: [
        {
          name: "saveUserMemory",
          description:
            "Saves a fact, preference, or context about the user. Categories: fact, preference, context, note. Supports tags and priority.",
          category: "Memory",
          icon: <Memory size={14} />,
          enabled: memoryOn,
          note: !memoryOn ? "USER_MEMORY_ENABLED is false" : undefined,
        },
        {
          name: "listUserMemory",
          description:
            "Searches the user's saved memories by query and category. Used at conversation start via preflight injection.",
          category: "Memory",
          icon: <Memory size={14} />,
          enabled: memoryOn,
        },
        {
          name: "deleteUserMemory",
          description:
            "Removes an outdated or corrected memory entry. Scoped to the owning user.",
          category: "Memory",
          icon: <Memory size={14} />,
          enabled: memoryOn,
        },
        {
          name: "autoMemoryExtraction",
          description:
            "Post-chat background extraction: scans each exchange for new facts/preferences and auto-saves high-confidence items.",
          category: "Memory",
          icon: <Lightbulb size={14} />,
          enabled: memoryOn && autoMemoryOn,
          note: !memoryOn
            ? "USER_MEMORY_ENABLED is false"
            : !autoMemoryOn
              ? "AUTO_MEMORY_ENABLED is not true"
              : undefined,
        },
      ],
    },
    {
      title: "Utility & Demo",
      description: "General-purpose tools and demonstration capabilities.",
      tools: [
        {
          name: "calculate",
          description:
            "Exact arithmetic, percentages, exponents, and functions (sqrt, pow, log, trig) with a safe evaluator. Also converts units (length, mass, time, data, volume, temperature) and live currency rates.",
          category: "Utility",
          icon: <Calculator size={14} />,
          enabled: true,
        },
        {
          name: "getWeather",
          description:
            "Fetches current weather and today's forecast from Open-Meteo API. Accepts a city/place name (geocoded) or latitude/longitude. Free, no API key needed.",
          category: "Utility",
          icon: <CloudSun size={14} />,
          enabled: true,
        },
        {
          name: "Flight Tools (×7)",
          description:
            "Demonstration flight booking system: search flights, select seats, create reservations, authorize payment, verify payment, display boarding pass, check flight status.",
          category: "Demo",
          icon: <Plane size={14} />,
          enabled: true,
        },
      ],
    },
  ];

  const tips = [
    {
      title: "Just ask naturally",
      body: "You don't need to name tools. Say what you want and the assistant picks the right capability automatically.",
    },
    {
      title: "Mention the web for current info",
      body: "Company questions are answered from the Notebook first. For news, prices, or anything recent, say so — the assistant will ask before going online.",
    },
    {
      title: "Paste links",
      body: "Drop any public URL into chat and the assistant reads the page for you, then answers from it.",
    },
    {
      title: "Teach it about you",
      body: "Say “remember that…” to store a preference or fact. You can review and delete saved memories at any time in /settings/agent.",
    },
    {
      title: "Check the sources",
      body: "Every company claim is cited with 【source — section or page】. Trusted sources are approved on the /knowledge page.",
    },
    {
      title: "Admins can grow knowledge",
      body: "Administrators can save notes straight from chat; they become searchable after review and publishing on /knowledge.",
    },
  ];

  return (
    <div className="page-shell mx-auto max-w-5xl">
      <div className="mb-10">
        <div className="mb-1 flex items-center gap-2 text-muted-foreground">
          <Sparkles size={14} />
          <span className="text-[11px] font-semibold uppercase tracking-[0.16em]">
            Assistant
          </span>
        </div>
        <h1 className="text-2xl font-semibold tracking-[-0.02em]">
          What the assistant can do
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          These capabilities are live in chat right now. You never have to
          remember tool names — just ask in plain language and the assistant
          chooses what it needs, then shows you where its answers come from.
        </p>
      </div>

      <div className="flex flex-col gap-10">
        {capabilitySections.map((section) => (
          <section
            key={section.id}
            id={`section-${section.id}`}
            aria-labelledby={`section-${section.id}-heading`}
          >
            <SectionHeader
              icon={section.icon}
              title={section.title}
              description={section.description}
              accent={section.accent}
              headingId={`section-${section.id}-heading`}
            />
            <div
              className={`grid gap-4 ${
                section.wide
                  ? "grid-cols-1"
                  : section.capabilities.length > 2
                    ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
                    : "grid-cols-1 sm:grid-cols-2"
              }`}
            >
              {section.capabilities.map((capability) => (
                <CapabilityCard key={capability.id} capability={capability} />
              ))}
            </div>
            {section.id === "web" ? (
              <div className="mt-4">
                <IntegrationCredentialCard
                  initialStatus={visibleTavilyStatus}
                  canConfigure={canConfigureCredentials}
                />
              </div>
            ) : null}
          </section>
        ))}

        <section aria-labelledby="tips-heading">
          <SectionHeader
            icon={<Lightbulb size={14} />}
            title="Getting the most out of it"
            description="A few patterns that work well with the assistant."
            accent={amber}
            headingId="tips-heading"
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {tips.map((tip) => (
              <div
                key={tip.title}
                className="rounded-3xl border border-black/[0.06] bg-white/75 p-4 dark:border-white/[0.07] dark:bg-white/[0.045]"
              >
                <h3 className="text-xs font-semibold">{tip.title}</h3>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  {tip.body}
                </p>
              </div>
            ))}
          </div>
        </section>

        <details className="group content-surface rounded-3xl p-5">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
            <div>
              <h2 className="text-sm font-semibold">For developers</h2>
              <p className="mt-0.5 text-sm text-muted-foreground">
                The full tool registry, feature flags, and architecture behind
                these capabilities.
              </p>
            </div>
            <ChevronDown
              size={16}
              className="shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
            />
          </summary>

          <div className="mt-5 flex flex-col gap-6">
            {toolGroups.map((group) => (
              <div key={group.title}>
                <h3 className="text-sm font-semibold">{group.title}</h3>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {group.description}
                </p>
                <div className="mt-3 flex flex-col gap-2">
                  {group.tools.map((tool) => (
                    <div
                      key={tool.name}
                      className="flex items-start gap-3 rounded-2xl bg-foreground/[0.03] px-3 py-2.5"
                    >
                      <span className="mt-0.5 shrink-0 text-muted-foreground">
                        {tool.icon}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <code className="text-xs font-semibold text-foreground">
                            {tool.name}
                          </code>
                          <Status enabled={tool.enabled} />
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {tool.description}
                        </p>
                        {tool.note ? (
                          <p className="mt-1 text-[11px] text-muted-foreground/70">
                            {tool.note}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            <div>
              <h3 className="text-sm font-semibold">Architecture</h3>
              <p className="mt-0.5 text-sm text-muted-foreground">
                All tools are composed in{" "}
                <code className="text-xs">ai/tools/index.ts → createChatTools()</code>{" "}
                and injected into the Vercel AI SDK{" "}
                <code className="text-xs">streamText()</code> call. Tools are
                provider-agnostic — the same tool object works with Google,
                OpenAI, Anthropic, DeepSeek, Mistral, and Groq without any
                provider-specific code.
              </p>
              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div className="rounded-2xl bg-foreground/[0.03] px-3 py-2.5">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    Provider Registry
                  </span>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    6 adapters: Google, OpenAI, Anthropic, DeepSeek, Mistral,
                    Groq. Each implements{" "}
                    <code className="text-[11px]">AIProviderAdapter</code> with{" "}
                    <code className="text-[11px]">createLanguageModel</code> and{" "}
                    <code className="text-[11px]">listModels</code>.
                  </p>
                </div>
                <div className="rounded-2xl bg-foreground/[0.03] px-3 py-2.5">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    Tool Execution
                  </span>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Tools execute server-side with full access to Prisma, fetch,
                    and Node APIs. AI SDK v7 handles tool-call parsing per
                    provider. Max 14 tool-call rounds via{" "}
                    <code className="text-[11px]">stepCountIs(14)</code>.
                  </p>
                </div>
                <div className="rounded-2xl bg-foreground/[0.03] px-3 py-2.5">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    Feature Flags
                  </span>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Independent toggles per tool group: KNOWLEDGE_CHAT_ENABLED,
                    WEB_SEARCH_ENABLED, AGENT_BROWSER_ENABLED,
                    USER_MEMORY_ENABLED, AUTO_MEMORY_ENABLED. Disabling a flag
                    hides the tools from chat without deleting data.
                  </p>
                </div>
                <div className="rounded-2xl bg-foreground/[0.03] px-3 py-2.5">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    Preflight Injection
                  </span>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Before each chat turn, knowledge preflight searches approved
                    sources and memory preflight loads the user&apos;s top 15
                    memories. Results are injected into the system prompt for
                    immediate context.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </details>
      </div>
    </div>
  );
}
