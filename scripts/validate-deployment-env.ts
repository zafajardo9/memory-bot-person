import { config } from "dotenv";

if (process.env.VERCEL !== "1") {
  config({ path: ".env.local", quiet: true });
}

const missing = ["AUTH_SECRET", "POSTGRES_URL"].filter(
  (name) => !process.env[name]?.trim(),
);

if (missing.length > 0) {
  console.error(
    `Missing required deployment environment variables: ${missing.join(", ")}`,
  );
  process.exit(1);
}

if (process.env.AUTH_SECRET!.trim().length < 32) {
  console.error(
    "AUTH_SECRET must contain at least 32 characters. Generate one with `openssl rand -base64 32`.",
  );
  process.exit(1);
}

if (process.env.WEB_SEARCH_ENABLED?.toLowerCase() === "true") {
  const mode = process.env.WEB_SEARCH_PROVIDER?.trim().toLowerCase() || "tavily";
  if (!["tavily", "tinyfish", "both"].includes(mode)) {
    console.error(
      `WEB_SEARCH_PROVIDER must be "tavily", "tinyfish", or "both" (got "${mode}").`,
    );
    process.exit(1);
  }
  const hasTavily = Boolean(process.env.TAVILY_API_KEY?.trim());
  const hasTinyFish = Boolean(process.env.TINYFISH_API_KEY?.trim());
  if (mode === "tavily" && !hasTavily) {
    console.error(
      "TAVILY_API_KEY is required when WEB_SEARCH_ENABLED=true and WEB_SEARCH_PROVIDER=tavily.",
    );
    process.exit(1);
  }
  if (mode === "tinyfish" && !hasTinyFish) {
    console.error(
      "TINYFISH_API_KEY is required when WEB_SEARCH_ENABLED=true and WEB_SEARCH_PROVIDER=tinyfish.",
    );
    process.exit(1);
  }
  if (mode === "both" && !hasTavily && !hasTinyFish) {
    console.error(
      "At least one of TAVILY_API_KEY or TINYFISH_API_KEY is required when WEB_SEARCH_ENABLED=true and WEB_SEARCH_PROVIDER=both.",
    );
    process.exit(1);
  }
}

console.log("Deployment environment is configured.");
