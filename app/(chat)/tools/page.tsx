import {
  BookOpen,
  CloudSun,
  Database,
  Globe,
  Lightbulb,
  MemoryStickIcon as Memory,
  MonitorCog,
  Plane,
  Search,
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

  const toolGroups: { title: string; description: string; tools: ToolEntry[] }[] = [
    {
      title: "Company Knowledge",
      description: "Retrieval-augmented search across approved team knowledge.",
      tools: [
        {
          name: "searchCompanyKnowledge",
          description:
            "Hybrid search (vector + full-text) across approved, non-archived knowledge sources. Returns ranked chunks with citation metadata.",
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
      ],
    },
    {
      title: "Web Search",
      description: "Live web search and page reading for current information.",
      tools: [
        {
          name: "webSearch",
          description:
            "Searches the public web via Tavily API. Returns clean markdown results with source URLs. Results are untrusted and supplementary to company knowledge.",
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
          icon: <Globe size={14} />,
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
          name: "getWeather",
          description:
            "Fetches current weather from Open-Meteo API for a given latitude/longitude. Free, no API key needed.",
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

  return (
    <div className="page-shell mx-auto max-w-4xl">
      <div className="mb-8">
        <div className="mb-1 flex items-center gap-2 text-muted-foreground">
          <Wrench size={14} />
          <span className="text-[11px] font-semibold uppercase tracking-[0.16em]">System</span>
        </div>
        <h1 className="text-2xl font-semibold tracking-[-0.02em]">Tool Integrations</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          These are the capabilities available to the AI assistant. Each tool runs server-side and works with
          every configured AI provider. Feature toggles control which tools are active in chat.
        </p>
      </div>

      <div className="flex flex-col gap-6">
        {toolGroups.map((group) => (
          <section key={group.title} className="content-surface rounded-3xl p-5">
            <h2 className="text-sm font-semibold">{group.title}</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">{group.description}</p>

            {group.title === "Web Search" ? (
              <IntegrationCredentialCard
                initialStatus={visibleTavilyStatus}
                canConfigure={canConfigureCredentials}
              />
            ) : null}

            <div className="mt-4 flex flex-col gap-2">
              {group.tools.map((tool) => (
                <div
                  key={tool.name}
                  className="flex items-start gap-3 rounded-2xl bg-foreground/[0.03] px-3 py-2.5"
                >
                  <span className="mt-0.5 shrink-0 text-muted-foreground">{tool.icon}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <code className="text-xs font-semibold text-foreground">{tool.name}</code>
                      <Status enabled={tool.enabled} />
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">{tool.description}</p>
                    {tool.note ? (
                      <p className="mt-1 text-[11px] text-muted-foreground/70">{tool.note}</p>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>

      <div className="content-surface mt-8 rounded-3xl p-5">
        <h2 className="text-sm font-semibold">Architecture</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          All tools are composed in <code className="text-xs">ai/tools/index.ts → createChatTools()</code> and
          injected into the Vercel AI SDK <code className="text-xs">streamText()</code> call. Tools are
          provider-agnostic — the same tool object works with Google, OpenAI, Anthropic, DeepSeek, Mistral, and
          Groq without any provider-specific code.
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <div className="rounded-2xl bg-foreground/[0.03] px-3 py-2.5">
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Provider Registry
            </span>
            <p className="mt-0.5 text-xs text-muted-foreground">
              6 adapters: Google, OpenAI, Anthropic, DeepSeek, Mistral, Groq. Each implements{" "}
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
              Tools execute server-side with full access to Prisma, fetch, and Node APIs. AI SDK v7 handles
              tool-call parsing per provider. Max 10 tool-call rounds via{" "}
              <code className="text-[11px]">stepCountIs(10)</code>.
            </p>
          </div>
          <div className="rounded-2xl bg-foreground/[0.03] px-3 py-2.5">
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Feature Flags
            </span>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Independent toggles per tool group: KNOWLEDGE_CHAT_ENABLED,
              WEB_SEARCH_ENABLED, AGENT_BROWSER_ENABLED, USER_MEMORY_ENABLED,
              AUTO_MEMORY_ENABLED. Disabling a flag hides the tools from chat
              without deleting data.
            </p>
          </div>
          <div className="rounded-2xl bg-foreground/[0.03] px-3 py-2.5">
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Preflight Injection
            </span>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Before each chat turn, knowledge preflight searches approved sources and memory preflight loads
              the user&apos;s top 15 memories. Results are injected into the
              system prompt for immediate context.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
