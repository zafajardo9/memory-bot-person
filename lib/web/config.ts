function positiveInteger(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isSafeInteger(value) && value > 0 ? value : fallback;
}

export const isWebSearchEnabled = () =>
  process.env.WEB_SEARCH_ENABLED?.toLowerCase() !== "false";
export const isAgentBrowserEnabled = () => {
  const configured = process.env.AGENT_BROWSER_ENABLED?.trim().toLowerCase();
  if (configured) return configured === "true";
  return process.env.NODE_ENV !== "production";
};
export const webSearchDailyLimit = () =>
  positiveInteger("WEB_SEARCH_MAX_DAILY", 100);
export const webPageContentLimit = () =>
  positiveInteger("WEB_PAGE_MAX_CHARACTERS", 12_000);
