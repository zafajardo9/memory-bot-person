import "server-only";

import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { isAbsolute } from "node:path";
import { promisify } from "node:util";

import { validatePublicUrl } from "@/lib/knowledge/url-security";

import {
  assertAgentBrowserResponse,
  parseAgentBrowserReadResponse,
} from "./agent-browser-response";
import { webPageContentLimit } from "./config";

const execFileAsync = promisify(execFile);
const EXECUTION_TIMEOUT_MS = 30_000;

export function agentBrowserBinaryPath() {
  const configured = process.env.AGENT_BROWSER_BINARY_PATH?.trim();
  if (configured) {
    if (!isAbsolute(configured)) {
      throw new Error("AGENT_BROWSER_BINARY_PATH must be an absolute path.");
    }
    return configured;
  }
  return "agent-browser";
}

export function isAgentBrowserInstalled() {
  return true;
}

function sanitizedEnvironment() {
  const environment = { ...process.env };
  // Ignore ambient Agent Browser configuration entirely. The server owns the
  // session, provider, profile, navigation boundaries, and output limits.
  for (const name of Object.keys(environment)) {
    if (name.startsWith("AGENT_BROWSER_")) delete environment[name];
  }
  environment.AGENT_BROWSER_HEADED = "false";
  environment.AGENT_BROWSER_NO_AUTO_DIALOG = "1";
  return environment;
}

async function runAgentBrowser(args: string[]) {
  const binary = agentBrowserBinaryPath();

  try {
    const { stdout } = await execFileAsync(
      /* turbopackIgnore: true */ binary,
      args,
      {
      encoding: "utf8",
      env: sanitizedEnvironment(),
      maxBuffer: Math.max(webPageContentLimit() * 4, 64_000),
      timeout: EXECUTION_TIMEOUT_MS,
      },
    );
    return stdout;
  } catch (error) {
    const stdout =
      typeof error === "object" &&
      error !== null &&
      "stdout" in error &&
      typeof error.stdout === "string"
        ? error.stdout
        : "";
    if (stdout) assertAgentBrowserResponse(stdout);
    throw error;
  }
}

export async function readRenderedWebPage(value: string) {
  const url = await validatePublicUrl(value);
  const session = `r-${randomUUID().replaceAll("-", "").slice(0, 16)}`;
  const hostname = url.hostname.toLocaleLowerCase();
  const limit = webPageContentLimit();
  // Agent Browser keys its daemon by launch configuration, so every command in
  // the session must repeat the same containment options.
  const commonArgs = [
    "--session",
    session,
    "--allowed-domains",
    hostname,
    "--content-boundaries",
    "--max-output",
    String(limit),
    "--idle-timeout",
    "30s",
  ];

  try {
    const opened = await runAgentBrowser([
      ...commonArgs,
      "open",
      url.toString(),
      "--json",
    ]);
    assertAgentBrowserResponse(opened);
    const output = await runAgentBrowser([...commonArgs, "read", "--json"]);
    const result = parseAgentBrowserReadResponse(output, limit);

    const finalUrl = await validatePublicUrl(result.url || url.toString());
    if (finalUrl.hostname.toLocaleLowerCase() !== hostname) {
      throw new Error("Agent Browser blocked a cross-domain redirect.");
    }

    return { ...result, url: finalUrl.toString() };
  } finally {
    await runAgentBrowser([...commonArgs, "close", "--json"]).catch(() => {
      // The session may already be closed after a launch or timeout failure.
    });
  }
}
