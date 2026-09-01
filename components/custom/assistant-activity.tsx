"use client";

import {
  Check,
  ChevronDown,
  ExternalLink,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Streamdown } from "streamdown";

import { AuthorizePayment } from "@/components/flights/authorize-payment";
import { DisplayBoardingPass } from "@/components/flights/boarding-pass";
import { CreateReservation } from "@/components/flights/create-reservation";
import { FlightStatus } from "@/components/flights/flight-status";
import { ListFlights } from "@/components/flights/list-flights";
import { SelectSeats } from "@/components/flights/select-seats";
import { VerifyPayment } from "@/components/flights/verify-payment";
import ToolChips from "@/components/primitives/ToolChips";

import { KnowledgeSourceCards } from "./knowledge-source-cards";
import { Weather } from "./weather";

import type { ToolStep } from "@/components/primitives/ToolChips";
import type {
  DynamicToolUIPart,
  ReasoningUIPart,
  SourceUrlUIPart,
  ToolUIPart,
} from "ai";

type ActivityToolPart = ToolUIPart | DynamicToolUIPart;
type ActivityPart = ReasoningUIPart | ActivityToolPart;

interface ToolPresentation {
  activeLabel: string;
  completeLabel: string;
  icon: string;
}

const toolPresentations: Record<string, ToolPresentation> = {
  webSearch: {
    activeLabel: "Searching the web",
    completeLabel: "Searched the web",
    icon: "run",
  },
  readWebPage: {
    activeLabel: "Reading a web page",
    completeLabel: "Read a web page",
    icon: "read",
  },
  browseWebPage: {
    activeLabel: "Rendering a web page",
    completeLabel: "Rendered a web page",
    icon: "run",
  },
  searchCompanyKnowledge: {
    activeLabel: "Searching company knowledge",
    completeLabel: "Searched company knowledge",
    icon: "read",
  },
  readCompanyKnowledge: {
    activeLabel: "Reading company sources",
    completeLabel: "Read company sources",
    icon: "read",
  },
  listCompanyKnowledgeSources: {
    activeLabel: "Checking available sources",
    completeLabel: "Checked available sources",
    icon: "read",
  },
  searchPersonalFiles: {
    activeLabel: "Searching your files",
    completeLabel: "Searched your files",
    icon: "read",
  },
  readFile: {
    activeLabel: "Reading a file",
    completeLabel: "Read a file",
    icon: "read",
  },
  listUserMemory: {
    activeLabel: "Checking saved context",
    completeLabel: "Checked saved context",
    icon: "read",
  },
  saveUserMemory: {
    activeLabel: "Remembering for later",
    completeLabel: "Saved to memory",
    icon: "write",
  },
  deleteUserMemory: {
    activeLabel: "Removing outdated context",
    completeLabel: "Removed from memory",
    icon: "write",
  },
};

export function getToolPresentation(toolName: string): ToolPresentation {
  if (toolPresentations[toolName]) return toolPresentations[toolName];

  const readableName = toolName
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[-_]/g, " ")
    .toLowerCase();
  return {
    activeLabel: `Using ${readableName}`,
    completeLabel: `Used ${readableName}`,
    icon: "run",
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function describeToolInput(toolName: string, input: unknown) {
  if (!isRecord(input)) return "";

  if (toolName === "webSearch" && typeof input.query === "string") {
    return `“${input.query}”`;
  }
  if (
    (toolName === "readWebPage" || toolName === "browseWebPage") &&
    typeof input.url === "string"
  ) {
    try {
      return new URL(input.url).hostname.replace(/^www\./, "");
    } catch {
      return input.url;
    }
  }
  if (
    (toolName === "searchCompanyKnowledge" ||
      toolName === "searchPersonalFiles") &&
    typeof input.query === "string"
  ) {
    return `“${input.query}”`;
  }
  if (toolName === "saveUserMemory" && typeof input.title === "string") {
    return input.title;
  }
  if (typeof input.filename === "string") return input.filename;
  if (typeof input.fileName === "string") return input.fileName;
  return "";
}

export function getToolActivityState(part: ActivityToolPart) {
  switch (part.state) {
    case "input-streaming":
      return { label: "Preparing", tone: "active" as const };
    case "input-available":
      return { label: "Working", tone: "active" as const };
    case "approval-requested":
      return { label: "Needs approval", tone: "waiting" as const };
    case "approval-responded":
      return part.approval.approved
        ? { label: "Working", tone: "active" as const }
        : { label: "Not approved", tone: "error" as const };
    case "output-error":
      return { label: "Failed", tone: "error" as const };
    case "output-denied":
      return { label: "Not approved", tone: "error" as const };
    case "output-available":
      return { label: "Done", tone: "done" as const };
  }
}

export function toolPartToStep(part: ActivityToolPart): ToolStep {
  const toolName =
    part.type === "dynamic-tool" ? part.toolName : part.type.slice(5);
  const presentation = getToolPresentation(toolName);
  const state = getToolActivityState(part);
  const isComplete = part.state === "output-available";
  const inputDescription = describeToolInput(toolName, part.input);

  return {
    id: part.toolCallId,
    icon: presentation.icon,
    label: isComplete
      ? presentation.completeLabel
      : presentation.activeLabel,
    chip: inputDescription || state.label,
    mono:
      toolName === "readFile" ||
      toolName === "readWebPage" ||
      toolName === "browseWebPage",
    status: state.tone,
    detail: [{ text: `Status: ${state.label}` }],
  };
}

export function reasoningPartToStep(
  part: ReasoningUIPart,
  index: number,
): ToolStep {
  const isStreaming = part.state === "streaming";
  const preview = part.text.trim().split(/\n+/)[0]?.slice(0, 120);

  return {
    id: `reasoning-${index}`,
    icon: "think",
    label: isStreaming ? "Thinking" : "Thought through the request",
    chip: preview || (isStreaming ? "Working through the request…" : "Complete"),
    status: isStreaming ? "active" : "done",
  };
}

function WebSearchOutput({ output }: { output: unknown }) {
  if (!isRecord(output) || !Array.isArray(output.results)) return null;
  const results = output.results.filter(isRecord).slice(0, 5);

  return (
    <div className="mt-2 space-y-2 pl-1">
      {results.map((result, index) => {
        const url = typeof result.url === "string" ? result.url : "";
        const title =
          typeof result.title === "string" ? result.title : `Result ${index + 1}`;
        const content =
          typeof result.content === "string" ? result.content : "";
        let domain = "";
        try {
          domain = new URL(url).hostname.replace(/^www\./, "");
        } catch {
          domain = url;
        }

        return (
          <a
            key={`${url}-${index}`}
            href={url}
            target="_blank"
            rel="noreferrer"
            className="group block rounded-lg py-1.5 pl-2 transition-colors hover:bg-foreground/[0.025] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="flex items-start justify-between gap-3">
              <span className="min-w-0">
                <span className="block truncate text-[11px] font-medium text-primary">
                  {domain}
                </span>
                <span className="mt-0.5 block text-sm font-medium leading-5 text-foreground">
                  {title}
                </span>
              </span>
              <ExternalLink
                size={13}
                className="mt-1 shrink-0 text-muted-foreground transition-colors group-hover:text-primary"
              />
            </span>
            {content ? (
              <span className="mt-1 line-clamp-2 block text-xs leading-5 text-muted-foreground">
                {content}
              </span>
            ) : null}
          </a>
        );
      })}
    </div>
  );
}

function ReadWebPageOutput({ output }: { output: unknown }) {
  if (!isRecord(output) || typeof output.url !== "string") return null;
  let domain = output.url;
  try {
    domain = new URL(output.url).hostname.replace(/^www\./, "");
  } catch {
    // Keep the returned URL as the readable fallback.
  }

  return (
    <a
      href={output.url}
      target="_blank"
      rel="noreferrer"
      className="mt-2 flex items-center justify-between gap-3 rounded-lg py-1.5 pl-2 text-sm transition-colors hover:bg-foreground/[0.025] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="min-w-0">
        <span className="block truncate font-medium">{domain}</span>
        <span className="text-xs text-muted-foreground">
          Page content ready
          {output.truncated === true ? " · shortened to fit" : ""}
        </span>
      </span>
      <ExternalLink size={14} className="shrink-0 text-muted-foreground" />
    </a>
  );
}

function GenericOutput({ output }: { output: unknown }) {
  if (output === undefined) return null;

  return (
    <details className="group/details mt-2 text-xs text-muted-foreground">
      <summary className="cursor-pointer list-none font-medium hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <span className="inline-flex items-center gap-1">
          View details
          <ChevronDown
            size={12}
            className="transition-transform group-open/details:rotate-180"
          />
        </span>
      </summary>
      <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded-lg bg-foreground/[0.025] p-2.5 font-mono text-[11px] leading-4">
        {JSON.stringify(output, null, 2)}
      </pre>
    </details>
  );
}

function ToolOutput({
  chatId,
  part,
  toolName,
}: {
  chatId: string;
  part: ActivityToolPart;
  toolName: string;
}) {
  if (part.state !== "output-available") return null;
  const output = part.output;

  if (toolName === "webSearch") return <WebSearchOutput output={output} />;
  if (toolName === "readWebPage") return <ReadWebPageOutput output={output} />;
  if (toolName === "searchCompanyKnowledge") {
    return <KnowledgeSourceCards output={output} />;
  }
  if (toolName === "readCompanyKnowledge") {
    return null;
  }
  if (toolName === "getWeather") {
    return (
      <div className="mt-3">
        <Weather weatherAtLocation={output as never} />
      </div>
    );
  }
  if (toolName === "displayFlightStatus") {
    return (
      <div className="mt-3">
        <FlightStatus flightStatus={output as never} />
      </div>
    );
  }
  if (toolName === "searchFlights") {
    return (
      <div className="mt-3">
        <ListFlights chatId={chatId} results={output as never} />
      </div>
    );
  }
  if (toolName === "selectSeats") {
    return (
      <div className="mt-3">
        <SelectSeats chatId={chatId} availability={output as never} />
      </div>
    );
  }
  if (
    toolName === "createReservation" &&
    !(isRecord(output) && "error" in output)
  ) {
    return (
      <div className="mt-3">
        <CreateReservation reservation={output as never} />
      </div>
    );
  }
  if (toolName === "authorizePayment") {
    return (
      <div className="mt-3">
        <AuthorizePayment intent={output as never} />
      </div>
    );
  }
  if (toolName === "displayBoardingPass") {
    return (
      <div className="mt-3">
        <DisplayBoardingPass boardingPass={output as never} />
      </div>
    );
  }
  if (toolName === "verifyPayment") {
    return (
      <div className="mt-3">
        <VerifyPayment result={output as never} />
      </div>
    );
  }

  if (
    toolName === "listUserMemory" ||
    toolName === "saveUserMemory" ||
    toolName === "deleteUserMemory"
  ) {
    return null;
  }

  return <GenericOutput output={output} />;
}

export function ProcessingCircles({ compact = false }: { compact?: boolean }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center ${compact ? "gap-0.5" : "gap-1"}`}
      role="status"
      aria-label="Processing"
    >
      {[0, 1, 2].map((index) => (
        <span
          key={index}
          aria-hidden
          className={`rounded-full bg-primary/70 animate-[pulse_1.2s_ease-in-out_infinite] motion-reduce:animate-none ${
            compact ? "size-1" : "size-1.5"
          }`}
          style={{ animationDelay: `${index * 160}ms` }}
        />
      ))}
    </span>
  );
}

function ToolStepDetail({
  chatId,
  part,
}: {
  chatId: string;
  part: ActivityToolPart;
}) {
  const toolName =
    part.type === "dynamic-tool" ? part.toolName : part.type.slice(5);
  const errorText =
    part.state === "output-error"
      ? part.errorText
      : part.state === "output-denied"
        ? "This action was not approved."
        : "";

  return (
    <div className="min-w-0 pb-1 pr-1">
      {errorText ? (
        <p className="whitespace-normal text-xs leading-5 text-red">{errorText}</p>
      ) : null}
      <ToolOutput chatId={chatId} part={part} toolName={toolName} />
    </div>
  );
}

function SourcesActivity({ sources }: { sources: SourceUrlUIPart[] }) {
  if (sources.length === 0) return null;

  return (
    <div className="relative pl-7">
      <span className="absolute left-0 top-0.5 flex size-5 items-center justify-center rounded-full bg-primary/[0.07] text-primary/75">
        <Check size={11} />
      </span>
      <div className="text-sm font-medium">Sources ready</div>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
        {sources.map((source, index) => (
          <span key={source.sourceId} className="inline-flex items-center gap-3">
            {index > 0 ? (
              <span aria-hidden className="text-border">
                ·
              </span>
            ) : null}
            <a
              href={source.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex max-w-full items-center gap-1 text-xs text-muted-foreground underline decoration-border underline-offset-4 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="truncate">{source.title ?? source.url}</span>
              <ExternalLink size={10} className="shrink-0" />
            </a>
          </span>
        ))}
      </div>
    </div>
  );
}

function researchSummary(tools: ActivityToolPart[]) {
  let notebookSources = 0;
  let webSources = 0;
  let researchingNow = false;

  for (const part of tools) {
    const toolName =
      part.type === "dynamic-tool" ? part.toolName : part.type.slice(5);

    if (
      toolName === "searchCompanyKnowledge" ||
      toolName === "readCompanyKnowledge" ||
      toolName === "webSearch" ||
      toolName === "readWebPage" ||
      toolName === "browseWebPage"
    ) {
      if (part.state !== "output-available") researchingNow = true;
    }

    if (part.state !== "output-available") continue;
    const output = part.output;
    if (!isRecord(output)) continue;

    if (toolName === "searchCompanyKnowledge" && Array.isArray(output.results)) {
      notebookSources += output.results.length;
    }
    if (toolName === "webSearch" && Array.isArray(output.results)) {
      webSources += output.results.length;
    }
  }

  return { notebookSources, webSources, researchingNow };
}

export function getActivityHeader({
  isActive,
  researchingNow,
  totalSources,
  toolCount,
  reasoningCount,
}: {
  isActive: boolean;
  researchingNow: boolean;
  totalSources: number;
  toolCount: number;
  reasoningCount: number;
}) {
  const sourcePhrase =
    totalSources === 0
      ? ""
      : ` · ${totalSources} source${totalSources === 1 ? "" : "s"}`;

  if (isActive) {
    return researchingNow
      ? `Researching${sourcePhrase}…`
      : "Composing your answer…";
  }

  const parts = [
    toolCount > 0
      ? `${toolCount} tool call${toolCount === 1 ? "" : "s"}`
      : null,
    reasoningCount > 0
      ? `${reasoningCount} thinking step${reasoningCount === 1 ? "" : "s"}`
      : null,
  ].filter(Boolean);

  return parts.length > 0 ? `${parts.join(", ")}${sourcePhrase}` : `Researched${sourcePhrase}`;
}

function ElapsedSeconds() {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    // Mounts fresh on each activation, so elapsed already starts at 0.
    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <span
      className="font-mono text-[11px] tabular-nums text-muted-foreground/70"
      aria-hidden
    >
      {elapsed}s
    </span>
  );
}

export function AssistantActivity({
  chatId,
  activity,
  sources,
  isActive,
}: {
  chatId: string;
  activity: ActivityPart[];
  sources: SourceUrlUIPart[];
  isActive: boolean;
}) {
  const tools = activity.filter(
    (part): part is ActivityToolPart => part.type !== "reasoning",
  );
  const reasoningCount = activity.length - tools.length;
  const hasActivity = activity.length > 0 || sources.length > 0;

  if (!hasActivity && !isActive) return null;

  const { notebookSources, webSources, researchingNow } =
    researchSummary(tools);
  const totalSources = notebookSources + webSources;
  const headerLabel = getActivityHeader({
    isActive,
    researchingNow,
    totalSources,
    toolCount: tools.length,
    reasoningCount,
  });
  const steps = activity.map((part, index): ToolStep => {
    if (part.type === "reasoning") {
      const step = reasoningPartToStep(part, index);
      return {
        ...step,
        detail: undefined,
        detailContent: part.text ? (
          <div className="whitespace-normal text-[12px] leading-5 text-ink-2">
            <Streamdown>{part.text}</Streamdown>
          </div>
        ) : undefined,
      };
    }

    return {
      ...toolPartToStep(part),
      detailContent: <ToolStepDetail chatId={chatId} part={part} />,
    };
  });

  return (
    <section aria-label="Assistant work trace" className="text-sm">
      <ToolChips
        steps={steps}
        diffs={[]}
        labels={{ header: headerLabel, more: "" }}
        progressive={false}
        animateRows={false}
        defaultOpen={isActive}
        headerAccessory={
          isActive ? (
            <>
              <ProcessingCircles compact />
              <ElapsedSeconds />
            </>
          ) : null
        }
        className="max-w-xl"
      />
      <SourcesActivity sources={sources} />
    </section>
  );
}
