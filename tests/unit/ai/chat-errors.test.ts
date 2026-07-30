import { APICallError, RetryError } from "ai";
import { describe, expect, it } from "vitest";

import {
  classifyChatError,
  classifyClientChatError,
  publicChatErrorMessage,
} from "@/lib/ai/chat-errors";

function apiError(statusCode: number, message: string, isRetryable = false) {
  return new APICallError({
    message,
    url: "https://provider.example/models/test",
    requestBodyValues: {},
    statusCode,
    isRetryable,
  });
}

describe("chat error presentation", () => {
  it("maps a retried 503 response to a temporary model problem", () => {
    const providerError = apiError(
      503,
      "This model is currently experiencing high demand.",
      true,
    );
    const error = new RetryError({
      message: "Failed after 3 attempts",
      reason: "maxRetriesExceeded",
      errors: [providerError],
    });

    expect(classifyChatError(error)).toMatchObject({
      kind: "model-busy",
      title: "Model temporarily unavailable",
    });
    expect(publicChatErrorMessage(error)).toContain(
      "experiencing high demand",
    );
  });

  it("maps rate limits and provider authentication separately", () => {
    expect(classifyChatError(apiError(429, "Rate limit exceeded")).kind).toBe(
      "rate-limit",
    );
    expect(classifyChatError(apiError(401, "Invalid API key")).kind).toBe(
      "provider-auth",
    );
  });

  it("does not expose unknown server error details", () => {
    const result = classifyChatError(
      new Error("database-host.internal leaked a secret"),
    );
    expect(result.kind).toBe("unknown");
    expect(result.message).not.toContain("database-host.internal");
    expect(result.message).not.toContain("secret");
  });

  it("restores the matching title from a safe streamed message", () => {
    const result = classifyClientChatError(
      new Error(
        "The selected model is experiencing high demand. Try again in a moment or choose another model.",
      ),
    );
    expect(result.title).toBe("Model temporarily unavailable");
  });
});
