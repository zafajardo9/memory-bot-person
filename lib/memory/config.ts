function enabled(name: string) {
  return process.env[name]?.toLowerCase() !== "false";
}

function positiveInteger(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isSafeInteger(value) && value > 0 ? value : fallback;
}

export const isUserMemoryEnabled = () => enabled("USER_MEMORY_ENABLED");
export const isAutoMemoryEnabled = () =>
  process.env.AUTO_MEMORY_ENABLED?.toLowerCase() === "true";
export const userMemoryLimit = () =>
  positiveInteger("USER_MEMORY_MAX_ENTRIES", 200);
export const userMemoryCacheTtlMs = () =>
  positiveInteger("USER_MEMORY_CACHE_TTL_MS", 30_000);

