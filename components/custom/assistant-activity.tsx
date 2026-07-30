"use client";

import {
  AlertCircle,
  BookOpenCheck,
  BrainCircuit,
  Check,
  ChevronDown,
  Database,
  ExternalLink,
  FileSearch,
  Globe2,
  LoaderCircle,
  Save,
  Search,
  Trash2,
  Wrench,
} from "lucide-react";
import { Streamdown } from "streamdown";

import { AuthorizePayment } from "@/components/flights/authorize-payment";
import { DisplayBoardingPass } from "@/components/flights/boarding-pass";
import { CreateReservation } from "@/components/flights/create-reservation";
import { FlightStatus } from "@/components/flights/flight-status";
import { ListFlights } from "@/components/flights/list-flights";
import { SelectSeats } from "@/components/flights/select-seats";
import { VerifyPayment } from "@/components/flights/verify-payment";

import { Weather } from "./weather";

import type {
  DynamicToolUIPart,
  ReasoningUIPart,
  SourceUrlUIPart,
  ToolUIPart,
} from "ai";
import type { LucideIcon } from "lucide-react";

type ActivityToolPart = ToolUIPart | DynamicToolUIPart;

interface ToolPresentation {
  activeLabel: string;
  completeLabel: string;
  icon: LucideIcon;
}

const toolPresentations: Record<string, ToolPresentation> = {
  webSearch: {
    activeLabel: "Searching the web",
    completeLabel: "Searched the web",
    icon: Globe2,
  },
  readWebPage: {
    activeLabel: "Reading a web page",
    completeLabel: "Read a web page",
    icon: Search,
  },
  browseWebPage: {
    activeLabel: "Rendering a web page",
    completeLabel: "Rendered a web page",
    icon: Globe2,
  },
  searchCompanyKnowledge: {
    activeLabel: "Searching company knowledge",
    completeLabel: "Searched company knowledge",
    icon: Database,
  },
  readCompanyKnowledge: {
    activeLabel: "Reading company sources",
    completeLabel: "Read company sources",
    icon: BookOpenCheck,
  },
  listCompanyKnowledgeSources: {
    activeLabel: "Checking available sources",
    completeLabel: "Checked available sources",
    icon: BookOpenCheck,
  },
  searchPersonalFiles: {
    activeLabel: "Searching your files",
    completeLabel: "Searched your files",
    icon: FileSearch,
  },
  readFile: {
    activeLabel: "Reading a file",
    completeLabel: "Read a file",
    icon: FileSearch,
  },
  listUserMemory: {
    activeLabel: "Checking saved context",
    completeLabel: "Checked saved context",
    icon: Database,
  },
  saveUserMemory: {
    activeLabel: "Remembering for later",
    completeLabel: "Saved to memory",
    icon: Save,
  },
  deleteUserMemory: {
    activeLabel: "Removing outdated context",
    completeLabel: "Removed from memory",
    icon: Trash2,
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
    icon: Wrench,
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

function toolState(part: ActivityToolPart) {
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
            className="group block border-l-2 border-border py-1 pl-3 transition-colors hover:border-sky-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="flex items-start justify-between gap-3">
              <span className="min-w-0">
                <span className="block truncate text-[11px] font-medium text-sky-700 dark:text-sky-300">
                  {domain}
                </span>
                <span className="mt-0.5 block text-sm font-medium leading-5 text-foreground">
                  {title}
                </span>
              </span>
              <ExternalLink
                size={13}
                className="mt-1 shrink-0 text-muted-foreground transition-colors group-hover:text-sky-600"
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
      className="mt-2 flex items-center justify-between gap-3 border-l-2 border-border py-1 pl-3 text-sm transition-colors hover:border-sky-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
      <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap border-l-2 border-border py-1 pl-3 font-mono text-[11px] leading-4">
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
  if (
    toolName === "searchCompanyKnowledge" ||
    toolName === "readCompanyKnowledge"
  ) {
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

function ReasoningActivity({ part }: { part: ReasoningUIPart }) {
  const isStreaming = part.state === "streaming";

  return (
    <div className="relative pb-4 pl-8 last:pb-0">
      <span className="absolute left-[9px] top-6 h-[calc(100%-12px)] w-px bg-border last:hidden" />
      <span className="absolute left-0 top-0.5 flex size-5 items-center justify-center rounded-full border border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300">
        <BrainCircuit size={11} />
      </span>
      <details className="group/reasoning" open={isStreaming || undefined}>
        <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <span>{isStreaming ? "Thinking" : "Thought through the request"}</span>
          {isStreaming ? (
            <LoaderCircle size={12} className="animate-spin text-violet-500" />
          ) : (
            <ChevronDown
              size={12}
              className="text-muted-foreground transition-transform group-open/reasoning:rotate-180"
            />
          )}
        </summary>
        <div className="mt-1.5 pl-0.5 text-[13px] leading-6 text-muted-foreground">
          <Streamdown>{part.text}</Streamdown>
        </div>
      </details>
    </div>
  );
}

function ToolActivity({
  chatId,
  part,
}: {
  chatId: string;
  part: ActivityToolPart;
}) {
  const toolName =
    part.type === "dynamic-tool" ? part.toolName : part.type.slice(5);
  const presentation = getToolPresentation(toolName);
  const state = toolState(part);
  const Icon = presentation.icon;
  const isComplete = part.state === "output-available";
  const inputDescription = describeToolInput(toolName, part.input);
  const errorText =
    part.state === "output-error"
      ? part.errorText
      : part.state === "output-denied"
        ? "This action was not approved."
        : "";

  return (
    <div className="relative pb-4 pl-8 last:pb-0">
      <span className="absolute left-[9px] top-6 h-[calc(100%-12px)] w-px bg-border last:hidden" />
      <span
        className={`absolute left-0 top-0.5 flex size-5 items-center justify-center rounded-full border ${
          state.tone === "error"
            ? "border-destructive/30 bg-destructive/10 text-destructive"
            : state.tone === "done"
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
              : "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300"
        }`}
      >
        {state.tone === "error" ? (
          <AlertCircle size={11} />
        ) : state.tone === "done" ? (
          <Check size={11} />
        ) : (
          <Icon size={11} />
        )}
      </span>

      <div>
        <div className="flex min-h-5 flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="text-sm font-medium">
            {isComplete
              ? presentation.completeLabel
              : presentation.activeLabel}
          </span>
          <span
            className={`inline-flex items-center gap-1 text-[11px] font-medium ${
              state.tone === "error"
                ? "text-destructive"
                : state.tone === "done"
                  ? "text-emerald-700 dark:text-emerald-300"
                  : state.tone === "waiting"
                    ? "text-amber-700 dark:text-amber-300"
                    : "text-sky-700 dark:text-sky-300"
            }`}
          >
            {state.tone === "active" ? (
              <LoaderCircle size={10} className="animate-spin" />
            ) : null}
            {state.label}
          </span>
        </div>
        {inputDescription ? (
          <p className="mt-0.5 break-words text-xs leading-5 text-muted-foreground">
            {inputDescription}
          </p>
        ) : null}
        {errorText ? (
          <p className="mt-1 text-xs leading-5 text-destructive">{errorText}</p>
        ) : null}
        <ToolOutput chatId={chatId} part={part} toolName={toolName} />
      </div>
    </div>
  );
}

function SourcesActivity({ sources }: { sources: SourceUrlUIPart[] }) {
  if (sources.length === 0) return null;

  return (
    <div className="relative pl-8">
      <span className="absolute left-0 top-0.5 flex size-5 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
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

export function AssistantActivity({
  chatId,
  reasoning,
  tools,
  sources,
  isActive,
}: {
  chatId: string;
  reasoning: ReasoningUIPart[];
  tools: ActivityToolPart[];
  sources: SourceUrlUIPart[];
  isActive: boolean;
}) {
  const hasActivity =
    reasoning.length > 0 || tools.length > 0 || sources.length > 0;

  if (!hasActivity && !isActive) return null;

  return (
    <section aria-label="Assistant work trace" className="text-sm">
      <details className="group/work" open={isActive || undefined}>
        <summary className="flex w-fit cursor-pointer list-none items-center gap-2 py-0.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          {isActive ? (
            <LoaderCircle size={13} className="animate-spin text-sky-500" />
          ) : (
            <Check size={13} className="text-emerald-600" />
          )}
          <span>
            {isActive ? "Working on your answer…" : "How this answer was prepared"}
          </span>
          <ChevronDown
            size={12}
            className="transition-transform group-open/work:rotate-180"
          />
        </summary>

        {hasActivity ? (
          <div className="mt-3 pl-0.5">
            {reasoning.map((part, index) => (
              <ReasoningActivity key={`reasoning-${index}`} part={part} />
            ))}
            {tools.map((part) => (
              <ToolActivity key={part.toolCallId} chatId={chatId} part={part} />
            ))}
            <SourcesActivity sources={sources} />
          </div>
        ) : null}
      </details>
    </section>
  );
}
