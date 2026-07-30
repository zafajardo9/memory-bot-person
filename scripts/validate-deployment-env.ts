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

if (
  process.env.WEB_SEARCH_ENABLED?.toLowerCase() === "true" &&
  !process.env.TAVILY_API_KEY?.trim()
) {
  console.error(
    "TAVILY_API_KEY is required when WEB_SEARCH_ENABLED=true.",
  );
  process.exit(1);
}

console.log("Deployment environment is configured.");
