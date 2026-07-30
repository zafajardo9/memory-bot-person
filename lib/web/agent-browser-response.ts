interface AgentBrowserResponse<T> {
  data?: T;
  error?: string | { message?: string } | null;
  success?: boolean;
}

interface AgentBrowserReadData {
  content?: string;
  contentType?: string;
  finalUrl?: string;
  source?: string;
  truncated?: boolean;
  url?: string;
}

function responseError(error: AgentBrowserResponse<unknown>["error"]) {
  if (typeof error === "string") return error;
  return error?.message ?? "Agent Browser could not read this page.";
}

function parseResponse<T>(stdout: string) {
  const line = stdout
    .trim()
    .split("\n")
    .filter(Boolean)
    .at(-1);
  if (!line) throw new Error("Agent Browser returned no output.");

  const response = JSON.parse(line) as AgentBrowserResponse<T>;
  if (!response.success) {
    throw new Error(responseError(response.error));
  }
  return response;
}

export function assertAgentBrowserResponse(stdout: string) {
  parseResponse<unknown>(stdout);
}

export function parseAgentBrowserReadResponse(stdout: string, limit: number) {
  const response = parseResponse<AgentBrowserReadData>(stdout);
  if (!response.data?.content?.trim()) {
    throw new Error("Agent Browser returned no readable page content.");
  }

  const content = response.data.content.trim();
  return {
    content: content.slice(0, limit),
    contentType: response.data.contentType ?? "text/html",
    source: response.data.source ?? "rendered-browser",
    truncated: Boolean(response.data.truncated) || content.length > limit,
    url: response.data.finalUrl ?? response.data.url ?? "",
  };
}
