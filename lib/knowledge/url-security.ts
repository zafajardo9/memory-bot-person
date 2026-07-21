import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

import { MAX_URL_RESPONSE_SIZE } from "./validation";

const MAX_REDIRECTS = 3;
const FETCH_TIMEOUT_MS = 15_000;

function isPrivateIpv4(address: string) {
  const parts = address.split(".").map(Number);
  const [a, b] = parts;

  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127) ||
    a >= 224
  );
}

function isPrivateIpv6(address: string) {
  const normalized = address.toLowerCase();
  return (
    normalized === "::" ||
    normalized === "::1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe8") ||
    normalized.startsWith("fe9") ||
    normalized.startsWith("fea") ||
    normalized.startsWith("feb") ||
    normalized.startsWith("::ffff:127.") ||
    normalized.startsWith("::ffff:10.") ||
    normalized.startsWith("::ffff:192.168.")
  );
}

async function assertPublicHostname(hostname: string) {
  if (hostname === "localhost" || hostname.endsWith(".local")) {
    throw new Error("Local and private network URLs are not allowed");
  }

  const literalVersion = isIP(hostname);
  const addresses = literalVersion
    ? [{ address: hostname, family: literalVersion }]
    : await lookup(hostname, { all: true, verbatim: true });

  if (addresses.length === 0) {
    throw new Error("The URL hostname could not be resolved");
  }

  for (const result of addresses) {
    const blocked =
      result.family === 4
        ? isPrivateIpv4(result.address)
        : isPrivateIpv6(result.address);

    if (blocked) {
      throw new Error("Local and private network URLs are not allowed");
    }
  }
}

export async function validatePublicUrl(value: string) {
  const url = new URL(value);

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("Only HTTP and HTTPS knowledge links are supported");
  }

  if (url.username || url.password) {
    throw new Error("URLs containing credentials are not allowed");
  }

  if (url.port && !["80", "443"].includes(url.port)) {
    throw new Error("Only standard HTTP and HTTPS ports are allowed");
  }

  url.hash = "";
  await assertPublicHostname(url.hostname);
  return url;
}

export async function fetchPublicKnowledgeUrl(value: string) {
  let currentUrl = await validatePublicUrl(value);

  for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect += 1) {
    const response = await fetch(currentUrl, {
      redirect: "manual",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: {
        "User-Agent": "CompanyKnowledgeBot/1.0",
        Accept: "text/html, text/plain, text/markdown, application/pdf",
      },
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location || redirect === MAX_REDIRECTS) {
        throw new Error("The knowledge URL redirected too many times");
      }
      currentUrl = await validatePublicUrl(new URL(location, currentUrl).toString());
      continue;
    }

    if (!response.ok) {
      throw new Error(`The knowledge URL returned HTTP ${response.status}`);
    }

    const declaredLength = Number(response.headers.get("content-length") ?? 0);
    if (declaredLength > MAX_URL_RESPONSE_SIZE) {
      throw new Error("The linked document is larger than 3 MB");
    }

    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > MAX_URL_RESPONSE_SIZE) {
      throw new Error("The linked document is larger than 3 MB");
    }

    return {
      bytes,
      url: currentUrl.toString(),
      contentType: response.headers.get("content-type")?.split(";")[0] ?? "text/html",
    };
  }

  throw new Error("Unable to fetch the knowledge URL");
}
