function positiveInteger(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isSafeInteger(value) && value > 0 ? value : fallback;
}

export type WebSearchProviderMode = "tavily" | "tinyfish" | "both";

/** Which web search provider(s) the current deployment should use. */
export const webSearchProviderMode = (): WebSearchProviderMode => {
  const value = process.env.WEB_SEARCH_PROVIDER?.trim().toLowerCase();
  return value === "tinyfish" || value === "both" ? value : "tavily";
};

export const isWebSearchEnabled = () =>
  process.env.WEB_SEARCH_ENABLED?.toLowerCase() !== "false";
export const isAgentBrowserEnabled = () => {
  // Vercel's serverless runtime cannot spawn the long-lived Agent Browser
  // process. Ignore an accidentally enabled flag there unless a deployment
  // explicitly provides its own executable (for example from a custom layer).
  if (
    process.env.VERCEL === "1" &&
    !process.env.AGENT_BROWSER_BINARY_PATH?.trim()
  ) {
    return false;
  }
  const configured = process.env.AGENT_BROWSER_ENABLED?.trim().toLowerCase();
  if (configured) return configured === "true";
  return process.env.NODE_ENV !== "production";
};
export const webSearchDailyLimit = () =>
  positiveInteger("WEB_SEARCH_MAX_DAILY", 100);
export const webPageContentLimit = () =>
  positiveInteger("WEB_PAGE_MAX_CHARACTERS", 12_000);
