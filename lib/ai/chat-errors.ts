import { APICallError, RetryError } from "ai";

export type ChatErrorKind =
  | "model-busy"
  | "rate-limit"
  | "provider-auth"
  | "connection"
  | "unknown";

export interface PublicChatError {
  kind: ChatErrorKind;
  title: string;
  message: string;
}

function errorDetails(error: unknown) {
  if (RetryError.isInstance(error)) {
    return errorDetails(error.lastError);
  }

  if (APICallError.isInstance(error)) {
    return {
      message: error.message,
      statusCode: error.statusCode,
      retryable: error.isRetryable,
    };
  }

  return {
    message: error instanceof Error ? error.message : String(error ?? ""),
    statusCode: undefined,
    retryable: false,
  };
}

export function classifyChatError(error: unknown): PublicChatError {
  const details = errorDetails(error);
  const normalized = details.message.toLowerCase();

  if (
    details.statusCode === 503 ||
    normalized.includes("high demand") ||
    normalized.includes("service unavailable") ||
    normalized.includes("temporarily unavailable")
  ) {
    return {
      kind: "model-busy",
      title: "Model temporarily unavailable",
      message:
        "The selected model is experiencing high demand. Try again in a moment or choose another model.",
    };
  }

  if (
    details.statusCode === 429 ||
    normalized.includes("rate limit") ||
    normalized.includes("quota")
  ) {
    return {
      kind: "rate-limit",
      title: "Model usage limit reached",
      message:
        "This provider is limiting requests right now. Wait a moment or choose another model.",
    };
  }

  if (
    details.statusCode === 401 ||
    details.statusCode === 403 ||
    normalized.includes("api key") ||
    normalized.includes("authentication")
  ) {
    return {
      kind: "provider-auth",
      title: "AI provider needs attention",
      message:
        "The selected provider could not authenticate. Choose another model or ask an administrator to check its connection.",
    };
  }

  if (
    details.retryable ||
    normalized.includes("timeout") ||
    normalized.includes("timed out") ||
    normalized.includes("network") ||
    normalized.includes("fetch failed")
  ) {
    return {
      kind: "connection",
      title: "Could not reach the model",
      message:
        "The model connection was interrupted. Check your connection and try again.",
    };
  }

  return {
    kind: "unknown",
    title: "The model hit a problem",
    message:
      "The selected model could not complete this response. Try again or choose another model.",
  };
}

export function publicChatErrorMessage(error: unknown) {
  return classifyChatError(error).message;
}

export function classifyClientChatError(error: Error): PublicChatError {
  const normalized = error.message.toLowerCase();

  if (normalized.includes("experiencing high demand")) {
    return {
      kind: "model-busy",
      title: "Model temporarily unavailable",
      message: error.message,
    };
  }
  if (normalized.includes("limiting requests")) {
    return {
      kind: "rate-limit",
      title: "Model usage limit reached",
      message: error.message,
    };
  }
  if (normalized.includes("could not authenticate")) {
    return {
      kind: "provider-auth",
      title: "AI provider needs attention",
      message: error.message,
    };
  }
  if (normalized.includes("connection was interrupted")) {
    return {
      kind: "connection",
      title: "Could not reach the model",
      message: error.message,
    };
  }

  return classifyChatError(error);
}
